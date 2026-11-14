const fs = require('fs');
const path = require('path');
const { buildGradingPrompt } = require('./essayKnowledgeBase');

function getConfigFile() {
    const dataDir = process.env.FENBI_DATA_DIR || path.join(__dirname, '../../data');
    return path.join(dataDir, 'ai_config.json');
}

function getHistoryFile() {
    const dataDir = process.env.FENBI_DATA_DIR || path.join(__dirname, '../../data');
    return path.join(dataDir, 'essay_records.json');
}

// 默认 AI 配置模板
const DEFAULT_CONFIG = {
    provider: 'deepseek', // deepseek, openai, qwen, ollama, custom
    baseURL: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.2
};

function ensureDirForFile(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * 对 API Key 做脱敏掩码处理
 */
function maskApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return '';
    const trimmed = apiKey.trim();
    if (!trimmed) return '';
    if (trimmed.length <= 8) return '****';
    return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}

function isLocalEndpoint(baseURL) {
    return typeof baseURL === 'string' && (baseURL.includes('localhost') || baseURL.includes('127.0.0.1'));
}

function buildChatCompletionsUrl(baseURL) {
    let url = (baseURL || DEFAULT_CONFIG.baseURL).trim().replace(/\/+$/, '');
    if (url.includes('/chat/completions')) {
        return url;
    }
    if (url.endsWith('/v1')) {
        return `${url}/chat/completions`;
    }
    return `${url}/v1/chat/completions`;
}

/**
 * 获取当前 AI 配置（内部使用，含完整密钥）
 */
function getAIConfig() {
    const configFile = getConfigFile();
    try {
        if (fs.existsSync(configFile)) {
            const data = fs.readFileSync(configFile, 'utf-8');
            return Object.assign({}, DEFAULT_CONFIG, JSON.parse(data));
        }
    } catch (e) {
        console.error('Read AI config error:', e);
    }
    return Object.assign({}, DEFAULT_CONFIG);
}

/**
 * 获取供前端展示的脱敏 AI 配置（不含明文 apiKey）
 */
function getPublicAIConfig() {
    const cfg = getAIConfig();
    return {
        provider: cfg.provider,
        baseURL: cfg.baseURL,
        model: cfg.model,
        temperature: cfg.temperature,
        hasApiKey: Boolean(cfg.apiKey && cfg.apiKey.trim()),
        maskedApiKey: maskApiKey(cfg.apiKey)
    };
}

/**
 * 保存 AI 配置（未提供新 apiKey 或仍为掩码时保留既有密钥）
 */
function saveAIConfig(config = {}) {
    const current = getAIConfig();
    const currentMasked = maskApiKey(current.apiKey);

    let nextApiKey = current.apiKey;
    if (config.clearApiKey === true) {
        nextApiKey = '';
    } else if (typeof config.apiKey === 'string') {
        const incoming = config.apiKey.trim();
        if (incoming && incoming !== currentMasked) {
            nextApiKey = incoming;
        }
    }

    const updated = {
        provider: typeof config.provider === 'string' && config.provider.trim() ? config.provider.trim() : current.provider,
        baseURL: typeof config.baseURL === 'string' && config.baseURL.trim() ? config.baseURL.trim() : current.baseURL,
        apiKey: nextApiKey,
        model: typeof config.model === 'string' && config.model.trim() ? config.model.trim() : current.model,
        temperature: typeof config.temperature === 'number' && !Number.isNaN(config.temperature)
            ? config.temperature
            : current.temperature
    };

    const configFile = getConfigFile();
    ensureDirForFile(configFile);
    fs.writeFileSync(configFile, JSON.stringify(updated, null, 2), 'utf-8');
    return getPublicAIConfig();
}

/**
 * 获取历史批改记录
 */
function getEssayHistory() {
    const historyFile = getHistoryFile();
    try {
        if (fs.existsSync(historyFile)) {
            const data = fs.readFileSync(historyFile, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Read essay history error:', e);
    }
    return [];
}

/**
 * 保存一条批改记录
 */
function saveEssayRecord(record) {
    const historyFile = getHistoryFile();
    const history = getEssayHistory();
    record.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    record.createdAt = new Date().toISOString();
    history.unshift(record);
    if (history.length > 100) {
        history.length = 100;
    }
    ensureDirForFile(historyFile);
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf-8');
    return record;
}

/**
 * 测试 AI 模型连接
 */
async function testConnection(customConfig = {}) {
    const saved = getAIConfig();
    const savedMasked = maskApiKey(saved.apiKey);
    const incomingKey = typeof customConfig.apiKey === 'string' ? customConfig.apiKey.trim() : '';

    const config = {
        baseURL: (customConfig.baseURL && customConfig.baseURL.trim()) || saved.baseURL,
        model: (customConfig.model && customConfig.model.trim()) || saved.model,
        apiKey: (incomingKey && incomingKey !== savedMasked) ? incomingKey : (customConfig.clearApiKey ? '' : saved.apiKey)
    };

    if (!config.apiKey && !isLocalEndpoint(config.baseURL)) {
        return {
            success: false,
            message: '请先填写 API Key（如果是本地 Ollama 则可不填）'
        };
    }

    const url = buildChatCompletionsUrl(config.baseURL);
    const startTime = Date.now();
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey || 'dummy'}`
            },
            body: JSON.stringify({
                model: config.model || 'deepseek-chat',
                messages: [
                    { role: 'user', content: 'Ping! 请回复一条极短问候。' }
                ],
                max_tokens: 20
            }),
            signal: AbortSignal.timeout(15000)
        });

        const latency = Date.now() - startTime;
        if (res.ok) {
            const json = await res.json();
            const reply = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
            return {
                success: true,
                message: `连接成功！响应延迟: ${latency}ms`,
                reply: (reply || '').trim()
            };
        } else {
            const errText = await res.text();
            return {
                success: false,
                message: `HTTP ${res.status}: ${errText.substring(0, 150)}`
            };
        }
    } catch (e) {
        return {
            success: false,
            message: `连接失败: ${e.message || e}`
        };
    }
}

/**
 * 健壮提取并解析 JSON
 */
function extractAndParseJSON(rawText) {
    if (!rawText) return null;
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        const startIdx = cleaned.indexOf('{');
        const endIdx = cleaned.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            const sub = cleaned.substring(startIdx, endIdx + 1);
            return JSON.parse(sub);
        }
        throw e;
    }
}

/**
 * 校验并补齐大模型返回的批改报告结构
 */
function validateEssayReport(report, maxScore = 20) {
    if (!report || typeof report !== 'object' || Array.isArray(report)) {
        throw new Error('模型返回结果不是有效的批改报告对象');
    }

    const parsedScore = Number(report.totalScore);
    if (Number.isNaN(parsedScore)) {
        throw new Error('模型返回结果缺少合法的 totalScore 评分字段');
    }

    const boundedScore = Math.max(0, Math.min(maxScore, parsedScore));
    const breakdown = report.scoreBreakdown && typeof report.scoreBreakdown === 'object'
        ? report.scoreBreakdown
        : {};

    return {
        totalScore: boundedScore,
        maxScore: Number(report.maxScore) || maxScore,
        rating: typeof report.rating === 'string' && report.rating.trim() ? report.rating.trim() : '已评定',
        scoreBreakdown: {
            keypointsScore: Number(breakdown.keypointsScore) || 0,
            keypointsMax: Number(breakdown.keypointsMax) || Math.round(maxScore * 0.7),
            structureScore: Number(breakdown.structureScore) || 0,
            structureMax: Number(breakdown.structureMax) || Math.round(maxScore * 0.2),
            languageScore: Number(breakdown.languageScore) || 0,
            languageMax: Number(breakdown.languageMax) || Math.max(1, maxScore - Math.round(maxScore * 0.7) - Math.round(maxScore * 0.2))
        },
        wordCountAnalysis: report.wordCountAnalysis && typeof report.wordCountAnalysis === 'object'
            ? report.wordCountAnalysis
            : { actualCount: 0, limitRequirement: '', isOverLimit: false, comment: '字数分析未提供' },
        keypointsChecklist: Array.isArray(report.keypointsChecklist) ? report.keypointsChecklist : [],
        structureDiagnosis: typeof report.structureDiagnosis === 'string' ? report.structureDiagnosis : '',
        languageAndWording: Array.isArray(report.languageAndWording) ? report.languageAndWording : [],
        summaryComment: typeof report.summaryComment === 'string' ? report.summaryComment : '',
        upgradedAnswer: typeof report.upgradedAnswer === 'string' ? report.upgradedAnswer : ''
    };
}

/**
 * 基于内置知识库与采分点规则的启发式智能批改（当未配置外部 API Key 时的开箱即用引擎）
 */
function gradeWithKnowledgeBase(params) {
    const {
        questionRequirement = '',
        standardAnswer = '',
        scoringPoints = [],
        userAnswer = '',
        maxScore = 20
    } = params;

    const answerClean = userAnswer.replace(/[\r\n\s]/g, '');
    const userWordsCount = answerClean.length;

    let totalScore = 0;
    const checklist = [];

    // 采分点匹配诊断
    const points = Array.isArray(scoringPoints) && scoringPoints.length > 0
        ? scoringPoints
        : [
            '核心概念界定与主题鲜明度（4分）',
            '逻辑层次分明，分类归纳有条理（4分）',
            '要点全面，准确提炼关键事实（4分）',
            '具体举措务实可行，针对性强（4分）',
            '语言精炼，符合政论规范（4分）'
        ];

    const keypointsBudget = Number((maxScore * 0.8).toFixed(1));
    const pointWeight = keypointsBudget / points.length;

    points.forEach((rawPoint) => {
        const purePoint = rawPoint.replace(/（\d+分）/, '').replace(/^\d+[\.、]/, '').trim();
        const keywords = purePoint.split(/[/、，,\s]+/).filter(w => w.length >= 2);

        let hitCount = 0;
        keywords.forEach(kw => {
            if (userAnswer.includes(kw)) {
                hitCount++;
            }
        });

        const isHit = keywords.length > 0 ? (hitCount / keywords.length >= 0.4 || hitCount >= 2) : false;
        const scoreEarned = isHit ? pointWeight : 0;
        totalScore += scoreEarned;

        checklist.push({
            point: rawPoint,
            weight: Number(pointWeight.toFixed(1)),
            hit: isHit,
            analysis: isHit
                ? '考生作答中较好地体现了关键要点（包含相关表述），得分有效。'
                : '材料核心要点未在答卷中明显呈现，建议针对此类关键词强化信息提取。'
        });
    });

    // 格式与结构判定
    const structureMax = Number((maxScore * 0.2).toFixed(1));
    let structureScore = Number((maxScore * 0.15).toFixed(1));
    let structureDiagnosis = '作答采用了分条列项的书写规范，条理较清晰。';
    if (userAnswer.includes('一、') || userAnswer.includes('1.') || userAnswer.includes('【')) {
        structureDiagnosis = '采用了规范的分条序号或小标题前置形式，层次条理严明，结构得分良好。';
    } else {
        structureDiagnosis = '作答未显著使用“一、二、三”分条序数或小标题归并，阅卷人视线容易疲劳，建议强化同类要点小标题归并。';
        structureScore = Math.max(1, Number((structureScore - 1.5).toFixed(1)));
    }

    // 语言与错词识别
    const languageAndWording = [];
    const oralWords = [
        { bad: '搞好', good: '切实推进 / 抓实抓细' },
        { bad: '非常多', good: '较为丰富 / 规模显著' },
        { bad: '办法', good: '有效举措 / 长效机制' },
        { bad: '老百姓', good: '人民群众 / 基层群众' },
        { bad: '弄好', good: '完善落实' }
    ];
    oralWords.forEach(w => {
        if (userAnswer.includes(w.bad)) {
            languageAndWording.push({
                original: w.bad,
                improved: w.good,
                reason: '替换为更规范的书面政论词汇'
            });
        }
    });

    const keypointsEarned = Number(totalScore.toFixed(1));
    const finalScore = Math.min(maxScore, Math.max(2, Math.round(keypointsEarned + structureScore)));
    let rating = '二类文上';
    const ratio = finalScore / maxScore;
    if (ratio >= 0.85) rating = '一类文 (优秀)';
    else if (ratio >= 0.70) rating = '二类文上 (良好)';
    else if (ratio >= 0.55) rating = '二类文下 (中等)';
    else rating = '三类文 (需加强)';

    return {
        totalScore: finalScore,
        maxScore,
        rating,
        isEngine: 'knowledge_base',
        scoreBreakdown: {
            keypointsScore: Math.max(0, Number((finalScore - structureScore).toFixed(1))),
            keypointsMax: Math.round(maxScore * 0.8),
            structureScore: structureScore,
            structureMax: Math.round(structureMax),
            languageScore: 0,
            languageMax: 0
        },
        wordCountAnalysis: {
            actualCount: userWordsCount,
            limitRequirement: questionRequirement,
            isOverLimit: false,
            comment: `实际有效字数 ${userWordsCount} 字，整体篇幅把控符合答题规范。`
        },
        keypointsChecklist: checklist,
        structureDiagnosis,
        languageAndWording: languageAndWording.length > 0 ? languageAndWording : [
            { original: '相关方面', improved: '多方协同联动', reason: '增强动词表现力' }
        ],
        summaryComment: `本题考查核心采分点命中率。作答总体条理清晰，综合得分率约为 ${Math.round(ratio * 100)}%。建议继续强化“关键词前置+浓缩要点”习惯，杜绝修饰性冗余词。`,
        upgradedAnswer: standardAnswer || '（参考公考官方标准答案进行对照订正）'
    };
}

/**
 * 执行申论智能批改（支持外部大模型，未配置时使用内置知识库；若外部调用失败明确标记降级原因）
 */
async function gradeEssay(params) {
    if (!params || !params.userAnswer || params.userAnswer.trim().length === 0) {
        throw new Error('作答内容为空，请先在答题纸中作答');
    }

    const config = getAIConfig();
    const hasExternalKey = Boolean(config.apiKey && config.apiKey.trim()) || isLocalEndpoint(config.baseURL);

    let report = null;
    let modelUsed = '内置知识库规则引擎';
    let engine = 'knowledge_base';
    let fallback = false;
    let fallbackReason = '';

    // 若配置了外部大模型 Key 或本地端点，优先调用真实 LLM
    if (hasExternalKey) {
        try {
            const { systemPrompt, userPrompt } = buildGradingPrompt(params);
            const url = buildChatCompletionsUrl(config.baseURL);

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey || 'dummy'}`
                },
                body: JSON.stringify({
                    model: config.model || 'deepseek-chat',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: typeof config.temperature === 'number' ? config.temperature : 0.2,
                    max_tokens: 3000
                }),
                signal: AbortSignal.timeout(90000)
            });

            if (!res.ok) {
                const errBody = await res.text().catch(() => '');
                throw new Error(`模型接口返回 HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 120)}` : ''}`);
            }

            const json = await res.json();
            const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
            if (!content) {
                throw new Error('模型响应中缺少 choices[0].message.content');
            }

            const parsed = extractAndParseJSON(content);
            report = validateEssayReport(parsed, Number(params.maxScore) || 20);
            report.isEngine = 'llm';
            modelUsed = config.model || 'external-llm';
            engine = 'llm';
        } catch (err) {
            fallback = true;
            fallbackReason = err && err.message ? err.message : String(err);
            console.warn('External LLM call failed, fallback to knowledge base:', fallbackReason);
        }
    }

    // 未配置外部模型或外部模型调用失败时，回退到内置知识库评分
    if (!report) {
        report = gradeWithKnowledgeBase(params);
    }

    const savedRecord = saveEssayRecord({
        questionId: params.questionId || '',
        questionTitle: params.questionTitle,
        questionType: params.questionType,
        userAnswer: params.userAnswer,
        report,
        model: modelUsed,
        engine,
        fallback,
        fallbackReason
    });

    return {
        recordId: savedRecord.id,
        engine,
        modelUsed,
        fallback,
        fallbackReason,
        report
    };
}

module.exports = {
    getAIConfig,
    getPublicAIConfig,
    saveAIConfig,
    getEssayHistory,
    testConnection,
    gradeEssay,
    maskApiKey,
    buildChatCompletionsUrl,
    extractAndParseJSON,
    validateEssayReport,
    gradeWithKnowledgeBase
};
