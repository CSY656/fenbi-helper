const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const aiScoreService = require('../src/service/aiScoreService');
const loginService = require('../src/service/loginService');
const exercisesResult = require('../src/service/exercisesResult');
const practiceService = require('../src/service/practiceService');
const ejs = require('ejs');

test('parseRawCookie 正确解析分号分隔 Cookie', () => {
    const items = loginService.parseRawCookie('userid=12345; fenbi_jwt=abc=def==; sid=xyz');
    assert.deepEqual(items, [
        { name: 'userid', value: '12345' },
        { name: 'fenbi_jwt', value: 'abc=def==' },
        { name: 'sid', value: 'xyz' }
    ]);
    assert.deepEqual(loginService.parseRawCookie(''), []);
});

test('maskApiKey 与 buildChatCompletionsUrl 格式正确', () => {
    assert.equal(aiScoreService.maskApiKey(''), '');
    assert.equal(aiScoreService.maskApiKey('123456'), '****');
    assert.equal(aiScoreService.maskApiKey('sk-1234567890abcd'), 'sk-1****abcd');

    assert.equal(
        aiScoreService.buildChatCompletionsUrl('https://api.deepseek.com'),
        'https://api.deepseek.com/v1/chat/completions'
    );
    assert.equal(
        aiScoreService.buildChatCompletionsUrl('https://api.openai.com/v1/'),
        'https://api.openai.com/v1/chat/completions'
    );
    assert.equal(
        aiScoreService.buildChatCompletionsUrl('https://example.com/v1/chat/completions'),
        'https://example.com/v1/chat/completions'
    );
});

test('saveAIConfig 脱敏返回并在未传入新 Key 时保留原密钥', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fenbi-test-'));
    const prevEnv = process.env.FENBI_DATA_DIR;
    process.env.FENBI_DATA_DIR = tmpDir;

    try {
        const saved1 = aiScoreService.saveAIConfig({
            provider: 'deepseek',
            baseURL: 'https://api.deepseek.com',
            apiKey: 'sk-testsecret9988',
            model: 'deepseek-chat'
        });
        assert.equal(saved1.hasApiKey, true);
        assert.equal(saved1.maskedApiKey, 'sk-t****9988');
        assert.equal('apiKey' in saved1, false);

        // 只修改 model，不传 apiKey，应保留原密钥
        const saved2 = aiScoreService.saveAIConfig({ model: 'deepseek-reasoner' });
        assert.equal(saved2.model, 'deepseek-reasoner');
        assert.equal(saved2.hasApiKey, true);
        assert.equal(aiScoreService.getAIConfig().apiKey, 'sk-testsecret9988');

        // 显式清空
        const saved3 = aiScoreService.saveAIConfig({ clearApiKey: true });
        assert.equal(saved3.hasApiKey, false);
        assert.equal(aiScoreService.getAIConfig().apiKey, '');
    } finally {
        if (prevEnv === undefined) delete process.env.FENBI_DATA_DIR;
        else process.env.FENBI_DATA_DIR = prevEnv;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('extractAndParseJSON 与 validateEssayReport 校验与容错', () => {
    const parsed = aiScoreService.extractAndParseJSON('说明如下：\n```json\n{"totalScore": 16, "rating": "二类文上", "keypointsChecklist": []}\n```');
    assert.equal(parsed.totalScore, 16);

    const validated = aiScoreService.validateEssayReport(parsed, 20);
    assert.equal(validated.totalScore, 16);
    assert.equal(validated.maxScore, 20);
    assert.ok(validated.scoreBreakdown);

    assert.throws(() => aiScoreService.validateEssayReport({ rating: '缺少分数' }, 20));
});

test('buildGradingPrompt 注入 kaogong 批改协议与证据链字段', () => {
    const { buildGradingPrompt, GRADING_PROTOCOL } = require('../src/service/essayKnowledgeBase');
    assert.ok(GRADING_PROTOCOL.length >= 6);

    const { systemPrompt, userPrompt } = buildGradingPrompt({
        questionType: 'summary',
        questionTitle: '概括S市举措',
        questionRequirement: '不超过250字',
        materials: ['S市建立统一数据共享中枢。'],
        scoringPoints: ['数据共享（10分）'],
        userAnswer: '一、建立数据共享中枢。',
        maxScore: 20
    });
    // 协议核心条款进入 system prompt
    assert.ok(systemPrompt.includes('训练设计'));
    assert.ok(systemPrompt.includes('语义等价'));
    assert.ok(systemPrompt.includes('重复处罚'));
    assert.ok(systemPrompt.includes('材料使用边界'));
    // JSON 模板含证据链字段
    assert.ok(userPrompt.includes('materialEvidence'));
    assert.ok(userPrompt.includes('userExpression'));
    assert.ok(userPrompt.includes('"earned"'));
    // 旧版无出处扣分规则已移除
    assert.ok(!systemPrompt.includes('超出字数上限扣 1~2 分'));
});

test('buildGradingPrompt 缺材料时禁止猜测材料得分点', () => {
    const { buildGradingPrompt } = require('../src/service/essayKnowledgeBase');
    const { userPrompt } = buildGradingPrompt({
        questionType: 'summary',
        questionTitle: '无材料题',
        scoringPoints: ['不应出现的预设点（10分）'],
        userAnswer: '一、测试。',
        maxScore: 20
    });
    assert.ok(userPrompt.includes('不得猜测材料得分点'));
    assert.ok(!userPrompt.includes('不应出现的预设点'));
});

test('gradeEssay 在未配置外部密钥时使用内置知识库引擎，且外部失败时标记 fallback', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fenbi-grade-'));
    const prevEnv = process.env.FENBI_DATA_DIR;
    process.env.FENBI_DATA_DIR = tmpDir;

    try {
        const kbResult = await aiScoreService.gradeEssay({
            questionId: 'sl-001',
            questionTitle: '测试题',
            questionType: 'summary',
            maxScore: 20,
            materials: ['S市推行流程重塑与集成化办理，推进数据共享和免证办。'],
            scoringPoints: ['流程重塑/集成化办理（4分）', '数据共享/免证办（4分）'],
            userAnswer: '一、推行流程重塑与集成化办理。二、推进数据共享和免证办。'
        });
        assert.equal(kbResult.engine, 'knowledge_base');
        assert.equal(kbResult.fallback, false);
        assert.ok(kbResult.report.totalScore >= 2);
        assert.equal(aiScoreService.getEssayHistory().length, 1);

        // 配置一个不可达的本地地址触发降级
        aiScoreService.saveAIConfig({
            baseURL: 'http://127.0.0.1:1',
            apiKey: 'sk-invalid-test',
            model: 'bad-model'
        });
        const fbResult = await aiScoreService.gradeEssay({
            questionId: 'sl-001',
            questionTitle: '测试降级',
            questionType: 'summary',
            maxScore: 20,
            materials: ['测试材料内容。'],
            userAnswer: '一、测试内容。'
        });
        assert.equal(fbResult.engine, 'knowledge_base');
        assert.equal(fbResult.fallback, true);
        assert.ok(fbResult.fallbackReason.length > 0);
    } finally {
        if (prevEnv === undefined) delete process.env.FENBI_DATA_DIR;
        else process.env.FENBI_DATA_DIR = prevEnv;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('本地申论评分识别明确采分短语，且不生成无关语言建议', () => {
    const materials = ['S市推行流程重塑与一件事集成化办理，建立统一数据共享中枢，推行电子证照，推进跨省通办，保留线下人工窗口。'];
    const fullAnswer = aiScoreService.gradeWithKnowledgeBase({
        maxScore: 20,
        materials,
        userAnswer: '一、流程重塑，推行一件事集成化办理。二、建立统一数据共享中枢。三、推行电子证照。四、推进“跨省通办”。五、保留线下人工窗口。',
        scoringPoints: [
            '流程重塑/一件事集成化办理，大幅压缩环节与审批时限（4分）',
            '打破数据壁垒/建立统一数据共享中枢，推进数据共享（4分）',
            '推行电子证照/电子印章应用，实现事项免证办（4分）',
            '推进跨区域/“跨省通办”，设立异地专窗（4分）',
            '保留线下人工窗口/提供上门帮办代办，弥合特殊群体数字鸿沟（4分）'
        ]
    });
    assert.equal(fullAnswer.totalScore, 20);
    assert.ok(fullAnswer.keypointsChecklist.every(point => point.hit));
    assert.deepEqual(fullAnswer.languageAndWording, []);
    // kaogong 证据链字段与优先修改任务
    assert.ok(fullAnswer.keypointsChecklist.every(point => point.materialEvidence && point.userExpression && point.earned > 0));
    assert.ok(fullAnswer.summaryComment.includes('训练估分'));
    assert.ok(fullAnswer.summaryComment.includes('优先修改任务'));

    const emptyAnswer = aiScoreService.gradeWithKnowledgeBase({
        maxScore: 20,
        materials,
        userAnswer: '一、这项工作很有意义。',
        scoringPoints: ['建立统一数据共享中枢（20分）']
    });
    assert.equal(emptyAnswer.keypointsChecklist[0].hit, false);
    assert.ok(emptyAnswer.totalScore < fullAnswer.totalScore);
    assert.ok(emptyAnswer.summaryComment.includes('建立统一数据共享中枢'));
});

test('本地申论评分缺材料时不猜测得分点、不给总分', () => {
    const report = aiScoreService.gradeWithKnowledgeBase({
        maxScore: 20,
        scoringPoints: ['建立统一数据共享中枢（20分）'],
        userAnswer: '一、建立统一数据共享中枢。'
    });
    assert.equal(report.totalScore, null);
    assert.deepEqual(report.keypointsChecklist, []);
    assert.equal(report.scoreBreakdown.keypointsMax, 0);
    assert.ok(report.rating.includes('缺材料'));
    assert.ok(report.summaryComment.includes('不猜测材料得分点'));
});

test('本地申论评分对大作文不给关键词估分，只给质性反馈', () => {
    const report = aiScoreService.gradeWithKnowledgeBase({
        questionType: 'essay',
        maxScore: 40,
        materials: ['求木之长者，必固其根本。'],
        scoringPoints: ['总论点立意准确深刻（10分）', '分论点层次分明且论据充分（12分）'],
        userAnswer: '固本培元，方能行稳致远。一、固思想之本。二、固科技之本。三、固治理之本。唯有夯实根基，方能行稳致远。'
    });
    assert.equal(report.totalScore, null);
    assert.deepEqual(report.keypointsChecklist, []);
    assert.ok(report.rating.includes('大作文'));
    assert.ok(report.summaryComment.includes('语义'));
    assert.ok(report.summaryComment.includes('接入大模型'));
    // 小题不受影响，仍正常估分
    const summary = aiScoreService.gradeWithKnowledgeBase({
        questionType: 'summary',
        maxScore: 20,
        materials: ['S市建立统一数据共享中枢。'],
        scoringPoints: ['建立统一数据共享中枢（20分）'],
        userAnswer: '一、建立统一数据共享中枢。'
    });
    assert.ok(summary.totalScore > 0);
});

test('validateEssayReport 补齐证据链字段并保留模型给出的 earned', () => {
    const validated = aiScoreService.validateEssayReport({
        totalScore: 12,
        keypointsChecklist: [
            { point: 'A', weight: 2, hit: true, materialEvidence: '材料1', userExpression: '原句A', earned: 1.5 },
            { point: 'B', weight: 2, hit: true },
            { point: 'C', weight: 2, hit: false }
        ]
    }, 20);
    assert.equal(validated.keypointsChecklist[0].earned, 1.5);
    assert.equal(validated.keypointsChecklist[0].materialEvidence, '材料1');
    // 旧格式：hit 无 earned 时按 weight 兜底，miss 为 0
    assert.equal(validated.keypointsChecklist[1].earned, 2);
    assert.equal(validated.keypointsChecklist[2].earned, 0);
    assert.equal(validated.keypointsChecklist[2].userExpression, '');
});

test('mapWithConcurrency 限制最大并发数且保持结果顺序', async () => {
    let active = 0;
    let maxSeen = 0;
    const inputs = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = await exercisesResult.mapWithConcurrency(inputs, 3, async (n) => {
        active++;
        maxSeen = Math.max(maxSeen, active);
        await new Promise(r => setTimeout(r, 15));
        active--;
        return n * 10;
    });
    assert.deepEqual(out, [10, 20, 30, 40, 50, 60, 70, 80]);
    assert.ok(maxSeen <= 3);
});

test('getXingceQuestions 离线支持 batch 轮换题目且 getXingceQuestionsWithMeta 返回来源状态', async () => {
    const batch0 = await practiceService.getXingceQuestions({ moduleId: 1, batch: 0 }, '');
    const batch1 = await practiceService.getXingceQuestions({ moduleId: 1, batch: 1 }, '');
    assert.equal(batch0.length, 2);
    assert.equal(batch1.length, 2);
    assert.notEqual(batch0[0].id, batch1[0].id);

    const meta = await practiceService.getXingceQuestionsWithMeta({ moduleId: 1, batch: 0 }, '');
    assert.equal(meta.sourceMode, 'local_no_cookie');
    assert.ok(meta.sourceMessage.length > 0);
    assert.equal(meta.questions.length, 2);

    // 即使 moduleId 是粉笔真实分类 ID（非 1..5），也能按 moduleName 精准切分模块
    const judge = await practiceService.getXingceQuestionsWithMeta({ moduleId: 656, moduleName: '判断推理', batch: 0 }, '');
    assert.equal(judge.questions.length, 2);
    assert.ok(judge.questions.every(q => q.moduleName.includes('判断')));

    const math = await practiceService.getXingceQuestionsWithMeta({ moduleId: 789, moduleName: '数量关系', batch: 0 }, '');
    assert.equal(math.questions.length, 1);
    assert.ok(math.questions.every(q => q.moduleName.includes('数量')));

    const politics = await practiceService.getXingceQuestionsWithMeta({ moduleId: 999, moduleName: '政治理论', batch: 0 }, '');
    assert.equal(politics.questions.length, 0);
    assert.equal(politics.sourceMode, 'local_empty');
    assert.ok(politics.sourceMessage.includes('不会使用其他科目题目代替'));
});

test('行测历史练习复用不会把常识判断误当成判断推理', async () => {
    const httpUtil = require('../src/util/httpUtil');
    const original = httpUtil.httpRequest;
    // 粉笔的 category-exercises 对不同分类返回同一批历史练习，只能靠练习名二次区分
    const exercises = [
        { id: 'a1', sheet: { name: '专项智能练习（常识判断）' } },
        { id: 'a2', sheet: { name: '专项智能练习（判断推理）' } }
    ];
    const questionById = {
        'q-cs': { id: 'q-cs', content: '下列关于我国新发展理念的表述，对应准确的是：' },
        'q-jd': { id: 'q-jd', content: '良法 : 善治' }
    };
    httpUtil.httpRequest = async function (opts) {
        if (/category-exercises/.test(opts.url)) {
            return { datas: exercises };
        }
        if (/exercises\/a1\/report/.test(opts.url)) {
            return { answers: [{ questionId: 'q-cs' }] };
        }
        if (/exercises\/a2\/report/.test(opts.url)) {
            return { answers: [{ questionId: 'q-jd' }] };
        }
        if (/solutions\?ids=/.test(opts.url)) {
            const ids = opts.url.split('ids=')[1].split(',');
            return ids.map(id => {
                const q = questionById[id];
                return {
                    id: q.id,
                    content: q.content,
                    accessories: [{ options: ['A', 'B', 'C', 'D'] }],
                    correctAnswer: { choice: 0 }
                };
            });
        }
        return null;
    };

    // practiceService 在加载时解构 httpRequest，替换后需重新加载模块才能捕获桩函数
    const psPath = require.resolve('../src/service/practiceService');
    const cachedPs = require.cache[psPath];
    delete require.cache[psPath];
    const practiceServiceUnderTest = require('../src/service/practiceService');

    try {
        const judge = await practiceServiceUnderTest.getXingceQuestionsWithMeta(
            { moduleId: 783924, moduleName: '判断推理', batch: 0 }, 'test-cookie');
        const common = await practiceServiceUnderTest.getXingceQuestionsWithMeta(
            { moduleId: 783921, moduleName: '常识判断', batch: 0 }, 'test-cookie');

        assert.equal(judge.sourceMode, 'online');
        assert.equal(common.sourceMode, 'online');
        assert.deepEqual(judge.questions.map(q => q.id), ['q-jd']);
        assert.deepEqual(common.questions.map(q => q.id), ['q-cs']);
    } finally {
        httpUtil.httpRequest = original;
        delete require.cache[psPath];
        require.cache[psPath] = cachedPs;
    }
});

test('loginService 会话持久化与清理', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fenbi-sess-'));
    const prevEnv = process.env.FENBI_DATA_DIR;
    process.env.FENBI_DATA_DIR = tmpDir;

    try {
        assert.deepEqual(loginService.loadSession(), { cookie: '', user: null });
        loginService.saveSession('sess=abc; userid=1', { nick: '测试学员' });
        const loaded = loginService.loadSession();
        assert.equal(loaded.cookie, 'sess=abc; userid=1');
        assert.equal(loaded.user.nick, '测试学员');

        loginService.clearSession();
        assert.deepEqual(loginService.loadSession(), { cookie: '', user: null });
    } finally {
        if (prevEnv === undefined) delete process.env.FENBI_DATA_DIR;
        else process.env.FENBI_DATA_DIR = prevEnv;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('行测已做题记录持久化并过滤重复题目', () => {
    const xingceDoneService = require('../src/service/xingceDoneService');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fenbi-done-'));
    const prevEnv = process.env.FENBI_DATA_DIR;
    process.env.FENBI_DATA_DIR = tmpDir;

    try {
        assert.deepEqual([...xingceDoneService.loadDoneIds()], []);
        xingceDoneService.addDoneIds([1001, '1002', null]);

        const done = xingceDoneService.loadDoneIds();
        assert.ok(done.has('1001'));
        assert.ok(done.has('1002'));
        assert.ok(!done.has('null'));

        const questions = [{ id: 1001 }, { id: '1002' }, { id: 2001 }];
        assert.deepEqual(xingceDoneService.filterUndone(questions, done), [{ id: 2001 }]);
    } finally {
        if (prevEnv === undefined) delete process.env.FENBI_DATA_DIR;
        else process.env.FENBI_DATA_DIR = prevEnv;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('practice-xingce.ejs 缺少 currentBatch/sourceMode 时不抛 ReferenceError', async () => {
    const html = await ejs.renderFile(path.join(__dirname, '../src/views/practice-xingce.ejs'), {
        modules: [{ id: 1, name: '言语' }],
        currentModuleId: 1,
        questions: []
    });
    assert.ok(html.includes('const currentBatch = 0;'));
});

test('getEssayQuestionsWithMeta 无 Cookie 时返回本地题库与来源提示', async () => {
    const result = await practiceService.getEssayQuestionsWithMeta('all', '');
    assert.equal(result.sourceMode, 'local_no_cookie');
    assert.ok(result.sourceMessage.length > 0);
    assert.ok(result.questions.length >= 5);
    assert.ok(result.questions.every(q => !q.online));

    const filtered = await practiceService.getEssayQuestionsWithMeta('essay', '');
    assert.ok(filtered.questions.every(q => q.type === 'essay'));
});

test('getEssayQuestionsWithMeta 在线拉取失败时降级本地并标记原因', async () => {
    // 无效 Cookie 会触发在线接口失败或空结果，两种都不允许抛异常
    const result = await practiceService.getEssayQuestionsWithMeta('all', 'sid=invalid-test-cookie');
    assert.ok(['local_fallback', 'local_empty', 'online'].includes(result.sourceMode));
    assert.ok(result.questions.length >= 5); // 本地兜底始终保留
    assert.ok(result.sourceMessage.length > 0);
});

test('practice-essay.ejs 渲染在线题与来源提示不抛错且转义材料', async () => {
    const onlineQuestion = {
        id: 'fb-999',
        type: 'summary',
        typeName: '归纳概括',
        examName: '测试在线卷',
        title: '测试题干',
        requirement: '不超过250字',
        maxScore: 10,
        maxWords: 250,
        materials: ['材料内容<script>alert(1)</script>'],
        standardAnswer: '参考答案',
        scoringPoints: [],
        online: true
    };
    const html = await ejs.renderFile(path.join(__dirname, '../src/views/practice-essay.ejs'), {
        currentType: 'all',
        questionList: [onlineQuestion],
        currentQuestion: onlineQuestion,
        sourceMode: 'online',
        sourceMessage: '已连接粉笔在线题库'
    });
    assert.ok(html.includes('〔在线〕'));
    assert.ok(html.includes('已连接粉笔在线题库'));
    // 在线材料走转义输出（currentQ JSON 中的 <\/script> 转义形式不构成可执行标签）
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    // 选卷入口与弹层存在
    assert.ok(html.includes('openPaperPicker'));
    assert.ok(html.includes('paperPickerModal'));
    assert.ok(html.includes('/api/essay/paper-labels'));

    // 缺 sourceMode 时（旧调用方式）也不抛 ReferenceError
    const html2 = await ejs.renderFile(path.join(__dirname, '../src/views/practice-essay.ejs'), {
        currentType: 'all',
        questionList: [onlineQuestion],
        currentQuestion: onlineQuestion
    });
    assert.ok(html2.includes('本地精选真题库'));
});

test('fetchShenlunLabels/LabelPapers 无 Cookie 时抛错而不返回假数据', async () => {
    // 空 Cookie 调用在线接口应失败（401），由路由层转成明确错误信息
    await assert.rejects(() => practiceService.fetchShenlunLabels(''));
    await assert.rejects(() => practiceService.fetchShenlunLabelPapers(101, ''));
});
