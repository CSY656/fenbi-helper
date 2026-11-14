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

test('practice-xingce.ejs 缺少 currentBatch/sourceMode 时不抛 ReferenceError', async () => {
    const html = await ejs.renderFile(path.join(__dirname, '../src/views/practice-xingce.ejs'), {
        modules: [{ id: 1, name: '言语' }],
        currentModuleId: 1,
        questions: []
    });
    assert.ok(html.includes('const currentBatch = 0;'));
});
