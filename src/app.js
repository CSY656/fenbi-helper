const Koa = require('koa');
const KoaRouter = require('koa-router');
const koaBody = require('koa-body');
const render = require('koa-ejs');
const serve = require('koa-static');
const path = require('path');
const qs = require('qs');
const url = require('url');

if (process.env.ALLOW_INSECURE_TLS === '1') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const app = new Koa();
const router = new KoaRouter();

const exerciseResult = require('./service/exercisesResult');
const loginService = require('./service/loginService');
const practiceService = require('./service/practiceService');
const aiScoreService = require('./service/aiScoreService');
const xingceDoneService = require('./service/xingceDoneService');

// 全局内存缓存的粉笔 Cookie，优先从持久化会话恢复，避免服务重启掉登录态
const persistedSession = loginService.loadSession();
let globalCookie = persistedSession.cookie || '';
let globalUserInfo = persistedSession.user || null;

render(app, {
    root: path.join(__dirname, 'views'),
    layout: false,
    viewExt: 'ejs',
    cache: false,
    debug: false,
});

// 全局异常捕获
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        console.error('[ServerError]', ctx.method, ctx.url, err);
        const statusCode = err.statusCode || err.status || 500;
        ctx.status = typeof statusCode === 'number' && statusCode >= 400 ? statusCode : 500;
        if (ctx.path.startsWith('/api/')) {
            ctx.body = {
                code: ctx.status,
                message: err.message || '请求处理时发生错误'
            };
            return;
        }
        ctx.body = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>系统提示</title></head>
            <body style="background: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 50px; text-align: center;">
                <div style="background: #fff; max-width: 500px; margin: 0 auto; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
                    <h2 style="color: #ff4d4f; margin-top: 0;">出错了</h2>
                    <p style="color: #666; font-size: 14px; line-height: 1.6;">${escapeHtml(err.message || '请求处理时发生错误')}</p>
                    <div style="margin-top: 25px;">
                        <a href="/history-category-complex" style="text-decoration: none; background: #1890ff; color: #fff; padding: 8px 18px; border-radius: 4px; font-size: 14px; margin-right: 10px;">返回首页</a>
                        <a href="/setup" style="text-decoration: none; background: #f0f0f0; color: #333; padding: 8px 18px; border-radius: 4px; font-size: 14px;">重新配置 Cookie</a>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
});

// 静态文件目录
app.use(serve(path.join(__dirname, 'views/js')));

// 解析请求体
app.use(koaBody());

/**
 * 获取当前请求有效 Cookie（优先客户端 headers，次选全局服务端已配置的 Cookie）
 */
function getEffectiveCookie(ctx) {
    let reqCookie = ctx.request.headers['cookie'] || '';
    const knownKeys = ['userid=', 'fenbi_jwt=', 'sid=', 'sess=', 'persistent='];
    if (reqCookie && knownKeys.some(k => reqCookie.includes(k))) {
        return reqCookie;
    }
    if (globalCookie) {
        return globalCookie;
    }
    return '';
}

async function requireCookieApi(ctx, next) {
    const cookie = getEffectiveCookie(ctx);
    if (!cookie) {
        ctx.status = 401;
        ctx.body = { code: 401, message: '请先在配置中心导入粉笔 Cookie 登录' };
        return;
    }
    ctx.state.effectiveCookie = cookie;
    await next();
}

// 路由定义 - 配置页
router.get('/setup', async ctx => {
    let currentCookie = getEffectiveCookie(ctx);
    await ctx.render('setup', {
        hasCookie: Boolean(currentCookie),
        userInfo: globalUserInfo
    });
});

// 导入 Cookie 登录
router.post('/api/import-cookie', async ctx => {
    let { cookie } = ctx.request.body || {};
    if (!cookie || typeof cookie !== 'string' || cookie.trim().length === 0) {
        ctx.status = 400;
        ctx.body = { code: 400, message: '请粘贴粉笔 Cookie 字符串' };
        return;
    }

    let trimmedCookie = cookie.trim();
    let checkResult = await loginService.validateCookie(trimmedCookie);
    if (!checkResult.valid) {
        ctx.status = 401;
        ctx.body = {
            code: 401,
            message: checkResult.message || '该 Cookie 无法访问粉笔题库，请确认是在登录粉笔网后复制的完整 Cookie'
        };
        return;
    }

    globalCookie = trimmedCookie;
    globalUserInfo = checkResult.user || { nick: '粉笔学员' };
    loginService.saveSession(globalCookie, globalUserInfo);

    let cookieList = loginService.parseRawCookie(trimmedCookie);
    cookieList.forEach(item => {
        try {
            ctx.cookies.set(item.name, item.value, {
                path: '/',
                maxAge: 365 * 24 * 3600 * 1000,
                httpOnly: true,
                sameSite: 'lax'
            });
        } catch (e) {}
    });

    ctx.body = {
        code: 200,
        message: '登录成功！',
        user: globalUserInfo,
        redirectPath: '/history-category-complex'
    };
});

// 校验当前登录状态
router.get('/api/check-login', async ctx => {
    let cookie = getEffectiveCookie(ctx);
    if (!cookie) {
        ctx.body = { loggedIn: false };
        return;
    }
    let res = await loginService.validateCookie(cookie);
    if (res.valid) {
        globalUserInfo = res.user;
        ctx.body = { loggedIn: true, user: res.user };
    } else {
        ctx.body = { loggedIn: false, message: res.message };
    }
});

// 退出/清除 Cookie
router.post('/api/logout', async ctx => {
    globalCookie = '';
    globalUserInfo = null;
    loginService.clearSession();
    let reqCookie = ctx.request.headers['cookie'] || '';
    let cookieList = loginService.parseRawCookie(reqCookie);
    cookieList.forEach(item => {
        try {
            ctx.cookies.set(item.name, '', {
                path: '/',
                maxAge: 0
            });
        } catch (e) {}
    });
    ctx.body = { code: 200, message: '已退出登录' };
});

// 账号密码登录（兼容旧版）
router.post('/api/login', async ctx => {
    let { phone, password, captcha } = ctx.request.body || {};
    try {
        let cookies = await loginService.login(phone, password, captcha);
        if (cookies && cookies.length > 0) {
            let cookieStrArr = [];
            cookies.forEach(c => {
                let { name, value } = c;
                cookieStrArr.push(`${name}=${value}`);
                ctx.cookies.set(name, value, {
                    path: '/',
                    maxAge: 365 * 24 * 3600 * 1000,
                    httpOnly: true,
                    sameSite: 'lax'
                });
            });
            globalCookie = cookieStrArr.join('; ');
            loginService.saveSession(globalCookie, globalUserInfo);
            let referer = ctx.request.headers.referer || '';
            let redirectPath = '/history-category-complex';
            try {
                let parsedQuery = qs.parse(url.parse(referer).query);
                if (parsedQuery && parsedQuery.redirectPath) {
                    redirectPath = parsedQuery.redirectPath;
                }
            } catch (e) {}

            ctx.body = {
                code: 200,
                redirectPath
            };
        } else {
            ctx.status = 401;
            ctx.body = {
                code: 401,
                message: '账号或密码错误，推荐使用上方【粉笔 Cookie 凭据】直接导入'
            };
        }
    } catch (err) {
        ctx.status = 502;
        ctx.body = {
            code: 502,
            message: '登录请求失败: ' + (err.message || '未知错误')
        };
    }
});

// ======================== 新增：在线刷题路由 ========================

// 行测刷题页面
router.get('/practice/xingce', async ctx => {
    let cookie = getEffectiveCookie(ctx);
    let modules = await practiceService.getXingceCategories(cookie);
    let moduleId = ctx.query.moduleId || (modules[0] && modules[0].id) || 1;
    let currentMod = modules.find(m => String(m.id) === String(moduleId)) || modules[0];
    let moduleName = currentMod ? currentMod.name : '';
    let batch = Math.max(0, Number.parseInt(ctx.query.batch || '0', 10) || 0);
    let result = await practiceService.getXingceQuestionsWithMeta({ moduleId, moduleName, batch }, cookie);
    let questions = xingceDoneService.filterUndone(result.questions);
    await ctx.render('practice-xingce', {
        modules,
        currentModuleId: moduleId,
        currentBatch: batch,
        questions,
        sourceMode: result.sourceMode,
        sourceMessage: result.sourceMessage
    });
});

// 申论真题答题与 AI 批改页面
router.get('/practice/essay', async ctx => {
    let type = ctx.query.type || 'all';
    let qid = ctx.query.qid;
    const paperId = ctx.query.paperId || '';
    const cookie = getEffectiveCookie(ctx);
    const result = await practiceService.getEssayQuestionsWithMeta(type, cookie, { paperId });
    let questionList = result.questions;
    let currentQuestion = null;
    let invalidQid = false;
    if (qid) {
        currentQuestion = practiceService.getEssayQuestionById(qid);
        if (!currentQuestion) {
            invalidQid = true;
            currentQuestion = questionList[0] || null;
        }
    } else {
        currentQuestion = questionList[0] || null;
    }
    if (!currentQuestion) currentQuestion = practiceService.getEssayQuestions('all')[0];

    await ctx.render('practice-essay', {
        currentType: type,
        questionList,
        currentQuestion,
        sourceMode: result.sourceMode,
        sourceMessage: result.sourceMessage,
        activePaperId: result.activePaperId,
        loadedPapers: result.loadedPapers || [],
        invalidQid
    });
});

// 申论在线套卷：考区标签分组（国考/各省/专项）
router.get('/api/essay/paper-labels', async ctx => {
    const cookie = getEffectiveCookie(ctx);
    if (!cookie) {
        ctx.body = { code: 200, labels: [], message: '未配置粉笔 Cookie，无法获取在线套卷目录' };
        return;
    }
    try {
        const labels = await practiceService.fetchShenlunLabels(cookie);
        ctx.body = { code: 200, labels };
    } catch (e) {
        ctx.status = 502;
        ctx.body = { code: 502, message: `获取考区标签失败：${e.message || e}` };
    }
});

// 申论在线套卷：某考区下的卷列表
router.get('/api/essay/label-papers', async ctx => {
    const cookie = getEffectiveCookie(ctx);
    const labelId = ctx.query.labelId;
    if (!cookie || !labelId) {
        ctx.status = 400;
        ctx.body = { code: 400, message: '缺少 labelId 或未配置粉笔 Cookie' };
        return;
    }
    try {
        const papers = await practiceService.fetchShenlunLabelPapers(labelId, cookie);
        ctx.body = { code: 200, papers };
    } catch (e) {
        ctx.status = 502;
        ctx.body = { code: 502, message: `获取套卷列表失败：${e.message || e}` };
    }
});

// ======================== 新增：大模型与 AI 批改 API ========================

// AI 模型配置获取（脱敏，不返回明文 apiKey）
router.get('/api/ai/config', async ctx => {
    ctx.body = aiScoreService.getPublicAIConfig();
});

// AI 模型配置保存
router.post('/api/ai/config', async ctx => {
    let body = ctx.request.body || {};
    let updated = aiScoreService.saveAIConfig(body);
    ctx.body = { code: 200, message: '配置已保存', config: updated };
});

// AI 模型连通性测试
router.post('/api/ai/test', async ctx => {
    let body = ctx.request.body || {};
    let result = await aiScoreService.testConnection(body);
    ctx.body = result;
});

// 申论 AI 智能批改请求
router.post('/api/essay/grade', async ctx => {
    let params = ctx.request.body || {};
    try {
        let result = await aiScoreService.gradeEssay(params);
        ctx.body = { code: 200, ...result };
    } catch (e) {
        const isEmptyAnswer = e.message === '作答内容为空，请先在答题纸中作答';
        ctx.status = isEmptyAnswer ? 400 : 500;
        ctx.body = { code: ctx.status, message: e.message || '批改失败' };
    }
});

// 申论历史批改记录
router.get('/api/essay/history', async ctx => {
    ctx.body = aiScoreService.getEssayHistory();
});

// ======================== 历史做题看板与查看 ========================

// 练习记录 - 分类复合视图
router.get('/history-category-complex', async ctx => {
    let cookie = getEffectiveCookie(ctx);
    if (!cookie) {
        ctx.redirect('/setup?redirectPath=' + encodeURIComponent(ctx.originalUrl));
        return;
    }
    let data = await exerciseResult.getExerciseHistory(cookie, { forceRefresh: ctx.query.refresh === '1' });
    await ctx.render('history-category-complex', data);
});

// 练习记录 - 分类视图
router.get('/history-category', async ctx => {
    let cookie = getEffectiveCookie(ctx);
    if (!cookie) {
        ctx.redirect('/setup?redirectPath=' + encodeURIComponent(ctx.originalUrl));
        return;
    }
    let data = await exerciseResult.getExerciseHistory(cookie, { forceRefresh: ctx.query.refresh === '1' });
    await ctx.render('history-category', data);
});

// 练习记录 - 列表视图
router.get('/history', async ctx => {
    let cookie = getEffectiveCookie(ctx);
    if (!cookie) {
        ctx.redirect('/setup?redirectPath=' + encodeURIComponent(ctx.originalUrl));
        return;
    }
    let data = await exerciseResult.getExerciseHistory(cookie, { forceRefresh: ctx.query.refresh === '1' });
    await ctx.render('history', data);
});

// 单次练习结果详情
router.get('/exercise/:exerciseId', async ctx => {
    let exerciseId = ctx.params.exerciseId;
    let costThreshold = Number.parseInt(ctx.query.cost || 70);
    let cookie = getEffectiveCookie(ctx);
    if (!cookie) {
        ctx.redirect('/setup?redirectPath=' + encodeURIComponent(ctx.originalUrl));
        return;
    }
    let renderObj = await exerciseResult.getResultObj(exerciseId, costThreshold, cookie);
    if (renderObj) {
        await ctx.render('exerciseResult', renderObj);
    } else {
        ctx.redirect('/history-category-complex');
    }
});

// 单题查看
router.get('/question/:questionId', async ctx => {
    let questionId = ctx.params.questionId;
    let cookie = getEffectiveCookie(ctx);
    if (!cookie) {
        ctx.redirect('/setup?redirectPath=' + encodeURIComponent(ctx.originalUrl));
        return;
    }
    let renderObj = await exerciseResult.getQuestion(questionId, cookie);
    if (renderObj) {
        await ctx.render('question', renderObj);
    } else {
        ctx.redirect('/history-category-complex');
    }
});

// 搜索页面
router.get('/search', async ctx => {
    let cookie = getEffectiveCookie(ctx);
    if (!cookie) {
        ctx.redirect('/setup?redirectPath=' + encodeURIComponent(ctx.originalUrl));
        return;
    }
    await ctx.render('search');
});

// 搜索接口
router.post('/api/search', requireCookieApi, async ctx => {
    let cookie = ctx.state.effectiveCookie;
    let { text } = ctx.request.body || {};
    ctx.body = await exerciseResult.search(text, cookie);
});

// 笔记保存
router.post('/api/saveNote/:questionId', requireCookieApi, async ctx => {
    let cookie = ctx.state.effectiveCookie;
    let questionId = ctx.params.questionId;
    let { noteContent } = ctx.request.body || {};
    ctx.body = await exerciseResult.saveNote(questionId, noteContent, cookie);
});

// 收藏
router.post('/api/collect/:questionId', requireCookieApi, async ctx => {
    let questionId = ctx.params.questionId;
    let cookie = ctx.state.effectiveCookie;
    await exerciseResult.addCollect(questionId, cookie);
    ctx.body = { success: true };
});

// 取消收藏
router.del('/api/collect/:questionId', requireCookieApi, async ctx => {
    let questionId = ctx.params.questionId;
    let cookie = ctx.state.effectiveCookie;
    await exerciseResult.delCollect(questionId, cookie);
    ctx.body = { success: true };
});

// 记录已做过的行测题（本地记录，用于题库去重；历史详情仍走粉笔分类看板）
router.post('/api/xingce/done', async ctx => {
    let ids = (ctx.request.body && ctx.request.body.ids) || [];
    xingceDoneService.addDoneIds(ids);
    ctx.body = { success: true };
});

// 获取视频解析
router.get('/api/video/:questionId', requireCookieApi, async ctx => {
    let questionId = ctx.params.questionId;
    let cookie = ctx.state.effectiveCookie;
    ctx.body = (await exerciseResult.getVideoUrl(questionId, cookie)) || '';
});

// 获取评论
router.get('/api/comment/:questionId', requireCookieApi, async ctx => {
    let questionId = ctx.params.questionId;
    let cookie = ctx.state.effectiveCookie;
    ctx.body = await exerciseResult.getComments(questionId, cookie);
});

// 查词造句
router.post('/api/zj', async ctx => {
    let { word } = ctx.request.body || {};
    ctx.body = await exerciseResult.zjWord(word);
});

// 速算工具
router.get('/calc', async ctx => {
    await ctx.render('calc', {});
});

router.get('/favicon.ico', async ctx => {
    ctx.status = 204;
});

router.all('/', async ctx => {
    let cookie = getEffectiveCookie(ctx);
    if (!cookie) {
        ctx.redirect('/setup');
    } else {
        ctx.redirect('/history-category-complex');
    }
});

app.use(router.routes()).use(router.allowedMethods());

// 404 处理
app.use(async (ctx, next) => {
    if (ctx.status === 404) {
        if (ctx.path.startsWith('/api/')) {
            ctx.status = 404;
            ctx.body = { code: 404, message: '接口不存在' };
            return;
        }
        ctx.redirect('/history-category-complex');
    } else {
        await next();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[Fenbi Helper] 服务已启动: http://localhost:${PORT}`);
});
