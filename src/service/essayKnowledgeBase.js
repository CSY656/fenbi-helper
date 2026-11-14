/**
 * 申论阅卷标准知识库与 Prompt 模板装配器
 */

const ESSAY_KNOWLEDGE_BASE = {
    // 1. 归纳概括题（单一题）
    summary: {
        name: '归纳概括题',
        corePrinciple: '关键词前置、同类归并、小标题提炼、宁滥勿缺',
        gradingRules: [
            '按点给分：踩中材料关键信息点与关键词即得分，未踩中或同义但脱离材料不给分。',
            '结构分（小标题/分类）：要求分类归纳的，必须有【核心词/小标题】，分类合理、逻辑清晰给结构分。',
            '语言表达：语言简洁精炼，去除修饰性词汇，紧贴材料原意，杜绝大段无意义铺垫。',
            '字数规范：严格控制在限定字数内，超出字数上限扣 1~2 分。'
        ],
        keywordsHint: '寻找材料中的高频词、主旨句、首尾总结句、指示代词后的核心论述。'
    },

    // 2. 综合分析题
    analysis: {
        name: '综合分析题',
        corePrinciple: '是什么（表态/释义）- 为什么（多维论证/分析）- 怎么办（对策/升华）',
        gradingRules: [
            '观点表态（是什么）：开篇准确解释概念、阐明本质或亮出对现象/观点的定性判断。',
            '多维分析（为什么）：从原因、影响、成绩、问题、背景等多维度展开辩证剖析，要点全面。',
            '总结对策（怎么办）：针对前面分析出的问题或结合题干提出切实的对策建议或总结升华。',
            '逻辑严谨：段落层次分明，逻辑链条严密，不可颠倒结构顺序。'
        ]
    },

    // 3. 提出对策题
    countermeasure: {
        name: '提出对策题',
        corePrinciple: '针对性、可行性、可操作性、操作主体与手段明确',
        gradingRules: [
            '针对性：对策必须精准对准材料中暴露的问题或原因，不可泛泛而谈无的放矢。',
            '可行性与合规性：符合国家法律法规与政策导向，符合行政机关职权范畴。',
            '可操作性（谁来做+怎么做）：包含责任主体、具体举措、实施路径与保障机制。',
            '分类展开：对策分条呈现，采用“小标题 + 展开叙述”的结构，条理清晰。'
        ]
    },

    // 4. 应用文/公文写作题
    official_doc: {
        name: '应用文写作题',
        corePrinciple: '格式规范、要素完整、语气贴切、目的鲜明',
        gradingRules: [
            '公文格式要素：标题、称谓/发文对象、正文（发文事由+具体事项/举措）、结语/号召、发文单位与落款日期（视题干是否要求完整格式）。',
            '发文语体与身份定位：严格根据题目设定的“作者身份”与“受文对象”确定用语口吻（如上行文尊重谦抑、下行文严肃明确、宣传文倡导感染）。',
            '内容要点：所有举措或事实均需扎根于材料，不可脱离材料盲目发挥。'
        ]
    },

    // 5. 文章写作题（大作文）
    essay: {
        name: '文章写作题（大作文）',
        corePrinciple: '立意高远明确、结构匀称严谨、论据充实有力、语言典雅规范',
        gradingRules: [
            '立意（核心关卡）：立意必须紧扣全篇给定资料的主题思想，站位高、不偏题、不套作，题目吸睛点题。',
            '结构架构：标准议论文结构（引论提出论点 - 本论展开分论点论证 - 结论总结升华），分论点之间逻辑递进或并列互补。',
            '论证质量：论点与论据契合，结合材料案例与时代宏观政策（如高质量发展、基层治理、中国式现代化等），论证扎实有力。',
            '语言文风：杜绝口语化与幼稚化表达，多用精炼有力的短句、排比与政论语体。'
        ]
    }
};

/**
 * 组装申论智能批改 Prompt
 */
function buildGradingPrompt(params) {
    const {
        questionType = 'summary',
        questionTitle = '',
        questionRequirement = '',
        materials = [],
        standardAnswer = '',
        scoringPoints = [],
        userAnswer = '',
        maxScore = 20
    } = params;

    const rule = ESSAY_KNOWLEDGE_BASE[questionType] || ESSAY_KNOWLEDGE_BASE.summary;

    let materialsText = '';
    if (Array.isArray(materials) && materials.length > 0) {
        materialsText = materials.map((m, idx) => `【材料 ${idx + 1}】\n${m}`).join('\n\n');
    } else if (typeof materials === 'string') {
        materialsText = materials;
    }

    let pointsText = '';
    if (Array.isArray(scoringPoints) && scoringPoints.length > 0) {
        pointsText = scoringPoints.map((p, idx) => `${idx + 1}. ${p}`).join('\n');
    }

    const systemPrompt = `你是一名有着 15 年以上国家公务员考试及省考申论阅卷经验的资深专家阅卷组组长。
你深谙公考阅卷规律（如采分点原则、关键词前置、反押题逻辑、公文格式与政论表达）。
请严格按照以下阅卷标准与知识库，对考生的作答进行专业、客观、严厉但极具指导意义的细致批改。

【本题题型指南与阅卷准则】
- 题型类别：${rule.name}
- 核心采分逻辑：${rule.corePrinciple}
- 阅卷评分细则：
${rule.gradingRules.map(r => `  * ${r}`).join('\n')}

你必须以纯 JSON 格式返回批改报告，不得包含 Markdown 代码块标记（如 \`\`\`json），直接输出合法 JSON 文本。`;

    const userPrompt = `【题目信息】
- 题干：${questionTitle}
- 作答要求与字数：${questionRequirement}
- 本题满分：${maxScore} 分

【给定参考资料】
${materialsText || '（以题目核心背景为准）'}

【官方参考答案 / 名师范文】
${standardAnswer || '（参考公考标准作答规范）'}

【标准采分要点（Checklist）】
${pointsText || '请结合材料与题干，严格提炼该题的核心采分点并予以对照。'}

【考生作答内容】
${userAnswer}

-----------------------
请执行批改并严格返回如下格式的 JSON 对象：
{
  "totalScore": 15.5,
  "maxScore": ${maxScore},
  "rating": "二类文上",
  "scoreBreakdown": {
    "keypointsScore": 10.5,
    "keypointsMax": 14,
    "structureScore": 3.0,
    "structureMax": 4,
    "languageScore": 2.0,
    "languageMax": 2
  },
  "wordCountAnalysis": {
    "actualCount": 268,
    "limitRequirement": "${questionRequirement}",
    "isOverLimit": false,
    "comment": "字数适中，符合答题纸要求"
  },
  "keypointsChecklist": [
    {
      "point": "采分要点内容描述",
      "weight": 2.0,
      "hit": true,
      "analysis": "考生在第1条中准确答出了该关键词"
    },
    {
      "point": "另一核心采分要点",
      "weight": 2.0,
      "hit": false,
      "analysis": "材料第2段明确提及此项，考生遗漏未作答"
    }
  ],
  "structureDiagnosis": "结构层面的点评，如小标题是否前置、逻辑分类是否严密等",
  "languageAndWording": [
    {
      "original": "考生原句中的口语化或不准确表达",
      "improved": "规范的申论书面语/政论术语替换建议",
      "reason": "原表达过于口语化，不够严谨"
    }
  ],
  "summaryComment": "总体评价与失分核心原因剖析",
  "upgradedAnswer": "基于考生原本的答题思路与要点，由阅卷专家润色重构后的高分示范作答（供考生直观对照提升）"
}`;

    return { systemPrompt, userPrompt };
}

module.exports = {
    ESSAY_KNOWLEDGE_BASE,
    buildGradingPrompt
};
