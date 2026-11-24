/**
 * 题库获取与组卷服务（行测 + 申论）
 */

const { httpRequest } = require('../util/httpUtil');
const xingceDoneService = require('./xingceDoneService');
const _ = require('lodash');

let headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh-TW;q=0.9,zh;q=0.8",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

// ======================== 内置高频经典申论真题题库 ========================
const ESSAY_QUESTIONS = [
    {
        id: 'sl-001',
        type: 'summary',
        typeName: '归纳概括',
        examName: '2023年国考申论行政执法卷（地市/执法）',
        title: '根据“给定资料1”，请概括S市在推进基层政务服务数字化转型中采取的主要举措。',
        requirement: '要求：全面、准确、有条理；字数不超过 250 字。',
        maxScore: 20,
        maxWords: 250,
        materials: [
            `近年来，S市聚焦群众和企业办事的痛点难点，大力推进“一网通办”和数字政务大厅建设。以往，市民办理新生儿出生证明、医保登记等事项，需要在卫健、人社、公安等部门之间来回跑，递交十几份纸质材料，耗时数周。针对这一现状，S市整合卫健、医保、公安等多部门系统，打造“出生一件事”集成化联办平台，将原有分散在不同部门的7个审批环节合并为一个协同流程，实现“一张表单申报、一套材料提交、一端在线办结”，办理时间由以往的平均20个工作日大幅压缩至3个工作日以内。`,
            `在打通数据壁垒方面，S市建立了全市统一的政务数据资源共享中枢，推动52个市级部门的政务服务数据互通共享。电子证照、电子印章在政务场景中全面普及，企业和市民免于重复提交身份证、营业执照、房产证等实体证照，实现了政务服务事项85%以上“免证办”。同时，S市推进跨区域“跨省通办”，与周边6个省市签订政务通办协同协议，设立异地通办专窗，为异地务工和经商人员提供无差别服务。`,
            `为了消除老年人和特殊群体的“数字鸿沟”，S市并未实行“一刀切”的无纸化，而是在各级便民服务中心设置“爱心帮办代办窗口”，保留现金支付和人工辅导，并配备具备方言交流能力、业务娴熟的专职网格引导员。对于行动不便的高龄孤寡老人和残疾人，社区网格员提供“政务微巡逻”上门走访，利用便携式移动政务终端，在群众家中直接完成人脸核验和高龄津贴认证，切实将数字化红利送达基层“最后一米”。`
        ],
        standardAnswer: `S市推进基层政务数字化转型的主要举措有：
一、流程重塑，集成服务。整合多部门业务系统，推行“一件事”集成联办，压缩审批环节与办理时限。
二、打破壁垒，数据赋能。建立全市统一数据共享中枢，普及电子证照与印章，实现高频事项“免证办”。
三、区域协同，跨省通办。联合周边省市设立专窗，实现异地政务无差别办理。
四、兼顾兜底，优化体验。保留线下人工帮办窗口，通过上门代办与方言辅导消除特殊群体“数字鸿沟”。`,
        scoringPoints: [
            '流程重塑/一件事集成化办理，大幅压缩环节与审批时限（4分）',
            '打破数据壁垒/建立统一数据共享中枢，推进数据共享（4分）',
            '推行电子证照/电子印章应用，实现事项免证办（4分）',
            '推进跨区域/“跨省通办”，设立异地专窗（4分）',
            '保留线下人工窗口/提供上门帮办代办，弥合特殊群体数字鸿沟（4分）'
        ]
    },
    {
        id: 'sl-002',
        type: 'analysis',
        typeName: '综合分析',
        examName: '2022年国考申论真题（副省/市地）',
        title: '根据“给定资料2”，谈谈你对文中“传统制造业的转型不仅是给机器插上电，更是给脑子换思想”这句话的理解。',
        requirement: '要求：观点明确，分析透彻，论述严谨，不超过 300 字。',
        maxScore: 20,
        maxWords: 300,
        materials: [
            `在F市的调研中，一家曾经濒临破产的轴承制造老厂引起了广泛关注。三年前，该厂投入数千万元采购了一批德国顶尖的自动化数控机床，厂房修得宽敞气派。然而一年过去，机床故障率高企，生产效率并没有预想的质的跃升，库存反而大量积压。厂长李某坦言：“当时以为数字化转型就是买新设备、给老机器通上电，结果管理方式还是老一套派工单、拍脑袋定产量，工人不懂数据分析，高级设备当成普通电动机用。”`,
            `痛定思痛后，该厂聘请了工业互联网专家重新梳理管理机制。他们不仅重塑了扁平化的柔性组织架构，还全员推行“数据思维”培训，把生产排期、物料流转和客户定制需求完全打通，实现了以市场订单倒逼生产线的柔性定制。工人们从单纯的“看机器工人”变成了懂看板调度的“数据分析员”。李厂长深有感触地说：“传统制造业的转型不仅是给机器插上电，更是给脑子换思想。设备更新只是硬件升级，核心是组织逻辑、管理思维与创新生态的全面重塑。”`
        ],
        standardAnswer: `这句话指出了传统制造业数字化转型的本质：不仅在于硬件设施的自动化升级，更在于管理理念、组织形态与人才思维的深层变革。
1. “给机器插上电”指片面追求设备采购、自动化流水线等硬件改造，若缺乏配套机制，极易导致大投入低产出与资源闲置。
2. “给脑子换思想”指必须转变发展思路：一是树立数据驱动思维，依据市场需求推行柔性定制与精益管理；二是重构扁平协同的现代企业管理架构；三是提升全员数字技能，推动产业工人转型。
因此，传统企业转型应坚持软硬件并重，以思想观念革新牵引体制机制与生产范式创新。`,
        scoringPoints: [
            '解释内涵：指出转型是硬件升级与理念机制变革的统一（4分）',
            '剖析“给机器插上电”：指片面追求自动化设备等硬件投入，缺乏配套导致效益低下（4分）',
            '剖析“给脑子换思想”：树立数据驱动与市场导向思维，推行柔性生产（4分）',
            '组织与人才重塑：优化扁平管理组织架构，培育高素质数字人才（4分）',
            '总结升华：提出软硬件协同、以观念更新驱动长效发展的结论（4分）'
        ]
    },
    {
        id: 'sl-003',
        type: 'countermeasure',
        typeName: '提出对策',
        examName: '2023年某省省考申论联考卷',
        title: '结合“给定资料3”，针对当前乡村电商直播中存在的突出问题，提出切实可行的治理对策。',
        requirement: '要求：针对性强，对策明确，条理清晰，不超过 350 字。',
        maxScore: 20,
        maxWords: 350,
        materials: [
            `近年来，乡村直播带货蓬勃发展，成为乡村振兴的新引擎，但也滋生出不少乱象。部分主播为了博取眼球，摆拍伪造贫困身世、虚构“果农滞销”惨状进行道德绑架式促销；一些农产品缺乏统一的检验检测和分级包装标准，生鲜农产品在快递物流过程中腐烂损耗严重，“样品光鲜、实物劣质”的投诉居高不下。`,
            `此外，多数乡村电商从业人员为本土农民，缺乏专业电商运营技巧和法律合规意识，合同纠纷频发。一些小作坊擅自冒用地理标志商标，以次充好，透支了本地农产品的品牌信誉。同时，乡村冷链仓储基础设施薄弱，最后一公里物流成本居高不下，制约了农产品外销的可持续发展。`
        ],
        standardAnswer: `治理乡村电商直播乱象的对策如下：
一、严格市场监管，净化网络生态。网信与市监部门严查虚假悲情营销、摆拍卖惨等欺诈行为，畅通投诉维权机制。
二、健全标准体系，筑牢品质根基。制定农产品分级、检测与包装规范，严把产地准出关，强化地标商标保护。
三、补齐基建短板，健全冷链物流。加大乡村冷链仓储与产地预冷设施投入，整合物流资源降低配送成本。
四、强化人才培育，赋能合规经营。开展电商运营、直播实务及法律法规培训，培育懂技术、守诚信的本土新农人。`,
        scoringPoints: [
            '加强直播营销监管，严惩虚假卖惨、夸大宣传与欺诈行为（5分）',
            '健全农产品质量检测、分级与标准化体系，强化品牌与地理标志保护（5分）',
            '完善乡村冷链仓储与产地前置仓等物流基础设施建设，降本增效（5分）',
            '加强本土电商新农人专业培训，提升合规意识与实操技能（5分）'
        ]
    },
    {
        id: 'sl-004',
        type: 'official_doc',
        typeName: '公文写作',
        examName: '2021年国考申论真题（副省）',
        title: '某区拟向全区干部职工推行“崇尚简约节约、反对铺张浪费”的倡议，请根据“给定资料4”拟写一份倡议书。',
        requirement: '要求：格式规范，语言有号召力，内容切合主题，不超过 400 字。',
        maxScore: 25,
        maxWords: 400,
        materials: [
            `机关食堂的剩饭剩菜现象依然存在，个别单位文具办公用品随意领用、公车私用或高能耗行驶、长明灯长流水等隐形浪费时有发生。机关干部的作风往往直接影响全社会的价值导向。建设节约型机关，需要从一饮一食、一纸一笔等细微处严起，形成厉行节约的制度约束和风尚自觉。`
        ],
        standardAnswer: `“厉行节约 反对浪费”倡议书

全区广大干部职工：
    勤俭节约是中华民族的传统美德，更是党政机关的优良作风。为深入贯彻绿色发展理念，建设节约型机关，特向大家发出如下倡议：
    一、践行光盘行动，遏制餐饮浪费。合理取餐，拒绝舌尖上的浪费，自觉抵制过量点餐和铺张宴请。
    二、推行绿色办公，降低行政能耗。强化无纸化办公，双面用纸，随手关灯关水，杜绝长明灯、长流水和设备空转。
    三、规范公务出行，倡导低碳环保。严禁公车私用，优先选择公共交通或步行骑行出行。
    四、发挥模范带头，弘扬清廉家风。广大干部职工要以身作则，带动家庭与社会形成节俭新风。
    节约从我做起，风尚由心而生。让我们迅速行动起来，做节约型社会的忠实践行者！

全区精神文明建设委员会
202X年X月X日`,
        scoringPoints: [
            '公文五要素齐全：标题鲜明、受文对象准确、正文要点分明、号召结语、发文主体与日期（5分）',
            '餐饮节约要点：践行光盘行动、科学按需用餐（5分）',
            '办公节能要点：双面用纸、杜绝长流水长明灯（5分）',
            '出行规范要点：公车合规管理、倡导绿色出行（5分）',
            '带头引领要点：发挥党员干部示范表率，带动社会风尚（5分）'
        ]
    },
    {
        id: 'sl-005',
        type: 'essay',
        typeName: '文章写作',
        examName: '2022年某省省考申论真题（A卷）',
        title: '结合给定资料，以“固本培元，方能行稳致远”为主题，自拟题目，写一篇议论文。',
        requirement: '要求：立意深刻明确，思路清晰，论述充实，语言流畅，字数 1000~1200 字。',
        maxScore: 40,
        maxWords: 1200,
        materials: [
            `古人云：“求木之长者，必固其根本；欲流之远者，必浚其泉源。”无论是科技创新的底层突破、实体经济的筑基固本，还是基层社会治理的源头化解，唯有夯实基础，方能抵御风浪，赢得长远发展。新时代新征程上，更需要我们沉下心来，厚植根基，避免急功近利。`
        ],
        standardAnswer: `立意指引与范文概要：
题目建议：《固本培元筑基石 守正笃行致远方》
总论点：立足新发展阶段，唯有在思想根基、科技创新、基层治理上固本培元，方能破浪前行、行稳致远。
分论点一：固思想政治之本，筑牢理想信念之基，以定力抵御急功近利之风。
分论点二：固实体科技之本，打好关键核心技术攻坚战，筑牢高质量发展硬支撑。
分论点三：固基层善治之本，推动力量下沉与源头治理，绘就和谐社会幸福底色。
结尾：总结升华，号召党员干部践行扎实作风，奋力推进中国式现代化建设。`,
        scoringPoints: [
            '总论点立意准确深刻：紧扣“固本培元与行稳致远”的辩证关系（10分）',
            '分论点层次分明且论据充分：涵盖政治理想、科技产业、基层社会等维度（12分）',
            '结构匀称严谨：引论点题、本论论证有力、结论升华（8分）',
            '语言表达典雅流畅：政论语体规范，用词丰富精炼，少语病错别字（6分）',
            '字数与格式规范：在 1000~1200 字区间，段落布局协调（4分）'
        ]
    }
];

// ======================== 内置高频经典行测真题题库 ========================
const XINGCE_MODULES = [
    { id: 1, name: '言语理解与表达', count: 40 },
    { id: 2, name: '判断推理', count: 40 },
    { id: 3, name: '数量关系', count: 15 },
    { id: 4, name: '资料分析', count: 20 },
    { id: 5, name: '常识判断', count: 20 }
];

const XINGCE_QUESTIONS = [
    {
        id: 1001,
        moduleId: 1,
        moduleName: '言语理解与表达',
        source: '2023年国考行政职业能力测验真题',
        content: '文化遗产是不可再生、不可替代的珍贵资源。保护文物功在当代、利在千秋。我们要本着对历史负责、对人民负责的精神，深入挖掘文物背后蕴含的哲学思想、人文精神、价值理念、道德规范，推动中华优秀传统文化__________、__________。',
        accessories: [{
            options: [
                '推陈出新 兼收并蓄',
                '创造性转化 创新性发展',
                '承前启后 继往开来',
                '生生不息 历久弥新'
            ]
        }],
        correctAnswer: { choice: 1 }, // B (下标1)
        difficulty: 3,
        solution: '<p>【解析】第一步，分析文段。文段论述要推动中华优秀传统文化的发展。横线处搭配“中华优秀传统文化”，且为党的二十大报告及相关政策文件的常见标准表述。第二步，对比选项。“创造性转化、创新性发展”（即“两创”）是新时代推动中华优秀传统文化传承发展的纲领性要求与固定搭配。因此，选择 B 选项。</p>',
        keypoints: [{ name: '实词与成语综合考查' }],
        tags: [{ name: '固定搭配' }]
    },
    {
        id: 1002,
        moduleId: 1,
        moduleName: '言语理解与表达',
        source: '2022年联考行测真题',
        content: '科学研究表明，植物并非被动的生命体，它们能够通过释放挥发性有机化合物向邻近植株__________危险信号。当遭受病虫侵害时，植物会分泌特定气味，警告同伴提前启动防御机制。这种植物间的通讯机制颠覆了人类长久以来对植物“默默无声”的刻板印象。这段文字意在说明：',
        accessories: [{
            options: [
                '植物具有主动防御病虫害的能力',
                '植物之间存在复杂的信息交流方式',
                '挥发性有机化合物是植物防御的核心',
                '人类低估了植物对环境的适应进化机制'
            ]
        }],
        correctAnswer: { choice: 1 }, // B
        difficulty: 2,
        solution: '<p>【解析】文段先介绍科学研究发现植物能通过挥发性有机物传递危险信号，并进行例证说明。尾句“这种植物间的通讯机制颠覆了……”为文段主旨句，意在强调植物之间存在信息交流与沟通机制。B项“植物之间存在复杂的信息交流方式”是主旨的同义替换。因此，选择 B 选项。</p>',
        keypoints: [{ name: '中心理解题' }],
        tags: [{ name: '主旨概括' }]
    },
    {
        id: 1003,
        moduleId: 2,
        moduleName: '判断推理',
        source: '2023年国考行测真题',
        content: '良法 : 善治',
        accessories: [{
            options: [
                '风调 : 雨顺',
                '水涨 : 船高',
                '严师 : 高徒',
                '敏思 : 笃行'
            ]
        }],
        correctAnswer: { choice: 2 }, // C
        difficulty: 3,
        solution: '<p>【解析】第一步：分析题干词语间逻辑关系。“良法”是产生“善治”的前提条件，好的法律才能实现好的社会治理，且“良”与“善”均为形容词修饰后面的名词。第二步：判断选项。“严师”是出“高徒”的前提条件，严厉优秀的老师才能培养出高水平的学生，逻辑关系与词性结构最为吻合。因此，选择 C 选项。</p>',
        keypoints: [{ name: '类比推理' }],
        tags: [{ name: '条件因果关系' }]
    },
    {
        id: 1004,
        moduleId: 2,
        moduleName: '判断推理',
        source: '2022年省考行测真题',
        content: '某高校开设了四门选修课，甲、乙、丙、丁四名同学每人只选了一门且互不相同。已知：（1）甲没有选《社会学》；（2）如果乙选了《心理学》，则丙选《哲学》；（3）丁选了《经济学》；（4）乙选了《心理学》或《社会学》。由此可以推出：',
        accessories: [{
            options: [
                '乙选了《社会学》',
                '甲选了《哲学》',
                '丙没有选《哲学》',
                '乙没有选《心理学》'
            ]
        }],
        correctAnswer: { choice: 1 }, // B
        difficulty: 4,
        solution: '<p>【解析】由（3）可知丁选了《经济学》；由（4）知乙在《心理学》或《社会学》中选。若乙选《心理学》，根据（2）丙选《哲学》，剩下的《社会学》只能甲选，与（1）矛盾。因此假设不成立，乙必须选《社会学》！此时剩下《心理学》和《哲学》，根据（2）否前件，甲丙分配；若乙选《社会学》，由于（1）甲不选社会学成立，丁选经济学，乙选社会学，由于乙未选心理学，丙不一定选哲学，但在四人各一门的情况下，甲只能选《哲学》，丙选《心理学》。因此选择 B 选项。</p>',
        keypoints: [{ name: '逻辑判断' }],
        tags: [{ name: '假言命题与排除法' }]
    },
    {
        id: 1005,
        moduleId: 3,
        moduleName: '数量关系',
        source: '2023年联考行测真题',
        content: '某车间生产甲、乙两种零件，甲零件每小时加工 12 个，乙零件每小时加工 15 个。某天工人总计加工了 7 小时，共加工了 96 个零件。问该天加工甲零件用了多少小时？',
        accessories: [{
            options: [
                '2 小时',
                '3 小时',
                '4 小时',
                '5 小时'
            ]
        }],
        correctAnswer: { choice: 1 }, // B (3小时)
        difficulty: 2,
        solution: '<p>【解析】鸡兔同笼法或方程法。设加工甲零件 x 小时，加工乙零件 (7 - x) 小时。列方程：12x + 15(7 - x) = 96，化简得：105 - 3x = 96，解得 3x = 9，x = 3。因此加工甲零件用了 3 小时。选择 B 选项。</p>',
        keypoints: [{ name: '基础工程与方程问题' }],
        tags: [{ name: '鸡兔同笼' }]
    },
    {
        id: 1006,
        moduleId: 4,
        moduleName: '资料分析',
        source: '2022年国考资料分析真题',
        material: '<p>【资料】2021年全国规模以上高技术制造业增加值比上年增长 18.2%，增速快于全部规模以上工业 8.6 个百分点；占规模以上工业增加值的比重为 15.1%，比上年提高 0.6 个百分点。其中，航空、航天器及设备制造业增长 27.2%，电子及通信设备制造业增长 19.3%，医药制造业增长 24.7%。</p>',
        content: '2021年全部规模以上工业增加值比上年增长约：',
        accessories: [{
            options: [
                '8.6%',
                '9.6%',
                '18.2%',
                '26.8%'
            ]
        }],
        correctAnswer: { choice: 1 }, // B (18.2% - 8.6% = 9.6%)
        difficulty: 2,
        solution: '<p>【解析】简单计算。由资料第一句“2021年全国规模以上高技术制造业增加值比上年增长18.2%，增速快于全部规模以上工业8.6个百分点”，可知全部规模以上工业增加值增速为 18.2% - 8.6% = 9.6%。因此选择 B 选项。</p>',
        keypoints: [{ name: '增长率计算' }],
        tags: [{ name: '简单计算' }]
    },
    {
        id: 1007,
        moduleId: 5,
        moduleName: '常识判断',
        source: '2023年国考常识真题',
        content: '下列关于我国新发展理念的表述，对应准确的是：',
        accessories: [{
            options: [
                '创新——解决社会公平正义问题',
                '协调——解决人与自然和谐共生问题',
                '绿色——解决内外联动问题',
                '共享——解决社会公平正义问题'
            ]
        }],
        correctAnswer: { choice: 3 }, // D
        difficulty: 2,
        solution: '<p>【解析】创新注重的是解决发展动力问题；协调注重的是解决发展不平衡问题；绿色注重的是解决人与自然和谐共生问题；开放注重的是解决发展内外联动问题；共享注重的是解决社会公平正义问题。因此 D 选项对应正确。</p>',
        keypoints: [{ name: '政治常识' }],
        tags: [{ name: '新发展理念' }]
    }
];

/**
 * 获取行测分类与考点列表
 */
async function getXingceCategories(cookie) {
    if (cookie) {
        try {
            let res = await httpRequest({
                url: 'https://tiku.fenbi.com/api/xingce/categories?filter=keypoint&app=web&kav=12&version=3.0.0.0',
                method: 'GET',
                json: true,
                headers: { ...headers, cookie },
                timeout: 5000
            });
            if (Array.isArray(res) && res.length > 0) {
                return res.map(cat => ({
                    id: cat.id,
                    name: cat.name.split('-')[0],
                    children: (cat.children || []).map(c => ({
                        id: c.id,
                        name: c.name.split('-')[0]
                    }))
                }));
            }
        } catch (e) {
            console.warn('Pull xingce categories from fenbi failed, use default:', e.message);
        }
    }
    return XINGCE_MODULES.map(m => ({ id: m.id, name: m.name, children: [] }));
}

const MODULE_SEARCH_KEYWORDS = [
    { match: '言语', moduleId: 1, queries: ['这段文字意在说明', '填入划横线部分最恰当', '这段话主要讲述', '最恰当的一项'] },
    { match: '常识', moduleId: 5, queries: ['下列说法正确的是', '下列说法错误的是', '关于我国', '宪法规定'] },
    { match: '判断推理', moduleId: 2, queries: ['由此可以推出', '最能削弱上述', '最能支持上述', '根据上述定义'] },
    { match: '数量', moduleId: 3, queries: ['至少需要', '多少元', '多少小时', '概率为'] },
    { match: '资料', moduleId: 4, queries: ['同比增长', '占全国', '百分点', '平均每'] }
];

function inferModuleMeta(moduleId, moduleName) {
    const nameStr = String(moduleName || '');
    if (nameStr) {
        for (const item of MODULE_SEARCH_KEYWORDS) {
            if (nameStr.includes(item.match)) {
                return item;
            }
        }
        // 政治理论等新分类不能默认当成言语理解
        return { match: nameStr, moduleId, queries: [] };
    }
    for (const item of MODULE_SEARCH_KEYWORDS) {
        if (String(moduleId) === String(item.moduleId)) {
            return item;
        }
    }
    return MODULE_SEARCH_KEYWORDS[0];
}

function normalizeCorrectAnswer(q, optionCount) {
    const answer = (q && q.correctAnswer) || {};
    const rawChoice = Array.isArray(answer.choices) ? answer.choices[0] : answer.choice;
    const choice = rawChoice !== '' && rawChoice !== null && rawChoice !== undefined
        ? Number(rawChoice)
        : -1;
    return {
        choice: Number.isInteger(choice) && choice >= 0 && choice < optionCount ? choice : -1
    };
}

function normalizeOnlineQuestion(q, idx, moduleId, moduleName) {
    if (!q || !q.id) return null;
    const options = q.accessories && q.accessories[0] && q.accessories[0].options;
    if (!Array.isArray(options) || options.length === 0) return null;

    return {
        id: q.id,
        idx: idx + 1,
        moduleId: moduleId || 1,
        moduleName: moduleName || q.source || '粉笔真题练习',
        source: q.source || '粉笔题库',
        content: q.content || '',
        material: q.material ? (q.material.content || q.material) : null,
        accessories: q.accessories || [],
        correctAnswer: normalizeCorrectAnswer(q, options.length),
        difficulty: q.difficulty || 3,
        solution: q.solution || '<p>暂无解析</p>',
        keypoints: (q.keypoints || []).map(k => (typeof k === 'string' ? { name: k } : k)),
        tags: (q.tags || []).map(t => (typeof t === 'string' ? { name: t } : t))
    };
}

async function fetchSolutionsByIds(qids, cookie, moduleId, moduleName) {
    if (!Array.isArray(qids) || qids.length === 0) return [];
    const targetIds = qids.slice(0, 15);
    const solRes = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/solutions?ids=${targetIds.join(',')}`,
        method: 'GET',
        json: true,
        headers: { ...headers, cookie },
        timeout: 6000
    });
    if (!Array.isArray(solRes)) return [];
    return solRes
        .map((q, idx) => normalizeOnlineQuestion(q, idx, moduleId, moduleName))
        .filter(Boolean)
        .map((q, idx) => ({ ...q, idx: idx + 1 }));
}

async function loadExerciseQuestions(picked, catId, moduleName, cookie) {
    const [exDetail, exReport] = await Promise.all([
        httpRequest({
            url: `https://tiku.fenbi.com/api/xingce/exercises/${picked.id}`,
            method: 'GET',
            json: true,
            headers: { ...headers, cookie },
            timeout: 5000
        }).catch(() => null),
        httpRequest({
            url: `https://tiku.fenbi.com/api/xingce/exercises/${picked.id}/report/v2`,
            method: 'GET',
            json: true,
            headers: { ...headers, cookie },
            timeout: 5000
        }).catch(() => null)
    ]);

    let qids = [];
    if (exDetail && exDetail.sheet && Array.isArray(exDetail.sheet.questionIds)) {
        qids = exDetail.sheet.questionIds.filter(Boolean);
    } else if (exReport && Array.isArray(exReport.answers)) {
        qids = exReport.answers.map(a => a && a.questionId).filter(Boolean);
    } else if (exDetail && exDetail.userAnswers) {
        qids = Object.values(exDetail.userAnswers).map(u => u && u.questionId).filter(Boolean);
    }

    if (qids.length === 0) return [];
    return fetchSolutionsByIds(qids, cookie, catId, moduleName);
}

async function fetchFromUserExercises(catId, moduleName, batchNum, cookie, count) {
    const listResult = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/category-exercises?categoryId=${encodeURIComponent(catId || '1')}&cursor=0&count=${count}`,
        method: 'GET',
        json: true,
        headers: { ...headers, cookie },
        timeout: 5000
    }).catch(() => null);

    const allExercises = listResult && Array.isArray(listResult.datas) ? listResult.datas : [];
    if (allExercises.length === 0) return null;

    const meta = inferModuleMeta(catId, moduleName);
    const matched = allExercises.filter(ex => {
        const sName = (ex && ex.sheet && ex.sheet.name) || '';
        return sName.includes(meta.match);
    });
    // 只有命中当前模块的练习才直接复用；若没有命中，不强行拿其他模块的历史练习凑数
    if (matched.length === 0) return null;

    // 首屏按历史顺序复用当前模块的练习，但跳过已全部做完的那一套，
    // 否则路由的 filterUndone 会把题目全部过滤掉，误报“当前分类暂无可用题目”。
    const start = batchNum % matched.length;
    for (let i = 0; i < matched.length; i++) {
        const picked = matched[(start + i) % matched.length];
        if (!picked || !picked.id) continue;
        const questions = await loadExerciseQuestions(picked, catId, moduleName, cookie);
        const undone = xingceDoneService.filterUndone(questions);
        if (undone.length === 0) continue;
        return {
            questions: undone,
            sheetName: (picked.sheet && picked.sheet.name) || '粉笔真题练习'
        };
    }
    return null;
}

async function fetchFromNewExercise(catId, moduleName, cookie, count) {
    const limit = Math.min(50, Math.max(1, Number.parseInt(count, 10) || 15));
    const body = `type=3&keypointId=${encodeURIComponent(catId)}&limit=${limit}&exerciseTimeMode=2`;
    const created = await httpRequest({
        url: 'https://tiku.fenbi.com/api/xingce/exercises',
        method: 'POST',
        body,
        json: true,
        headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded',
            cookie
        },
        timeout: 10000
    });
    const qids = created && created.sheet && Array.isArray(created.sheet.questionIds)
        ? created.sheet.questionIds.filter(Boolean)
        : [];
    if (qids.length === 0) return null;

    const questions = await fetchSolutionsByIds(qids, cookie, catId, moduleName);
    if (questions.length === 0) return null;
    return {
        questions,
        sheetName: (created.sheet && created.sheet.name) || `专项智能练习（${moduleName}）`
    };
}

async function fetchFromOnlineSearch(catId, moduleName, batchNum, cookie) {
    const meta = inferModuleMeta(catId, moduleName);
    if (meta.queries.length === 0) return null;
    const query = meta.queries[batchNum % meta.queries.length];
    const start = Math.floor(batchNum / meta.queries.length) * 15;

    const searchRes = await httpRequest({
        url: `https://tiku.fenbi.com/ipad/search/v2?system=12.4.7&inhouse=0&app=gwy&ua=iPad&av=44&version=6.11.3&kav=22&coursePrefix=xingce&format=json&len=15&q=${encodeURIComponent(query)}&start=${start}`,
        method: 'GET',
        json: true,
        headers: {
            ...headers,
            'User-Agent': 'XC/6.11.3 (iPad; iOS 12.4.7; Scale/2.00)',
            'Accept': '*/*',
            cookie
        },
        timeout: 6000
    });

    const items = _.get(searchRes, 'data.items', []);
    const qids = _.uniq(items.map(it => it && it.questionId).filter(Boolean));
    if (qids.length === 0) return null;

    const questions = await fetchSolutionsByIds(qids, cookie, catId, moduleName);
    if (questions.length === 0) return null;

    return { questions, query };
}

/**
 * 获取行测做题题目（含题库来源状态与提示信息）
 */
async function getXingceQuestionsWithMeta(params = {}, cookie) {
    let { moduleId, moduleName = '', count = 20, batch = 0 } = params;
    let batchNum = Math.max(0, Number.parseInt(batch, 10) || 0);
    let questions = [];
    let sourceMode = 'local_no_cookie';
    let sourceMessage = '当前未检测到粉笔登录 Cookie，已加载本地精选真题库（如需同步个人粉笔题库，请前往配置中心导入）。';

    // 若有 cookie，优先尝试粉笔在线接口
    if (cookie) {
        let lastErr = '';
        try {
            const catId = moduleId || 1;
            if (batchNum > 0) {
                // “再做一组”按当前知识点重新组卷，不能循环有限的历史练习。
                const fromNewExercise = await fetchFromNewExercise(catId, moduleName, cookie, count);
                if (fromNewExercise && fromNewExercise.questions.length > 0) {
                    questions = fromNewExercise.questions;
                    sourceMode = 'online';
                    sourceMessage = `已为「${moduleName}」生成第 ${batchNum + 1} 组专项练习（${fromNewExercise.sheetName}，共 ${questions.length} 题）。`;
                }
            } else {
                // 首次进入时优先展示当前科目的最近一套历史练习。
                const fromExercises = await fetchFromUserExercises(catId, moduleName, batchNum, cookie, count);
                if (fromExercises && fromExercises.questions.length > 0) {
                    questions = fromExercises.questions;
                    sourceMode = 'online';
                    sourceMessage = `已连接粉笔在线题库（来源练习：${fromExercises.sheetName}，共 ${questions.length} 题）。`;
                } else {
                    // 无历史练习时通过粉笔在线题库检索该模块真题。
                    const fromSearch = await fetchFromOnlineSearch(catId, moduleName, batchNum, cookie);
                    if (fromSearch && fromSearch.questions.length > 0) {
                        questions = fromSearch.questions;
                        sourceMode = 'online';
                        sourceMessage = `已连接粉笔在线题库（按「${moduleName || inferModuleMeta(catId, moduleName).match}」真题检索组卷，共 ${questions.length} 题）。`;
                    }
                }
            }
        } catch (e) {
            lastErr = e.message || String(e);
            console.warn('Fetch online xingce questions failed, falling back to local dataset:', lastErr);
        }

        if (questions.length === 0) {
            sourceMode = lastErr ? 'local_fallback' : 'local_empty';
            sourceMessage = lastErr
                ? `粉笔在线题库拉取失败（${lastErr}），已自动降级为本地精选真题库。`
                : '粉笔账号下暂未拉取到该模块的在线真题（可能 Cookie 已过期或接口受限），已自动切换为本地精选真题库。';
        }
    }

    // 兜底及离线场景使用经典题库（通过标准 meta.moduleId 精准匹配模块，避免“常识判断”误匹配“判断”）
    if (questions.length === 0) {
        const meta = inferModuleMeta(moduleId, moduleName);
        let filtered = XINGCE_QUESTIONS.filter(q => String(q.moduleId) === String(meta.moduleId));
        if (filtered.length === 0) {
            sourceMode = 'local_empty';
            sourceMessage = `当前分类「${moduleName || '未命名分类'}」暂无可用题目，请切换其他分类；不会使用其他科目题目代替。`;
            return { questions: [], sourceMode, sourceMessage };
        }
        let cloned = _.cloneDeep(filtered);
        if (cloned.length > 1 && batchNum > 0) {
            let offset = batchNum % cloned.length;
            cloned = cloned.slice(offset).concat(cloned.slice(0, offset));
        }
        questions = cloned.map((q, idx) => ({ ...q, idx: idx + 1 }));
    }

    return {
        questions,
        sourceMode,
        sourceMessage
    };
}

/**
 * 获取行测做题题目（数组形式，保持兼容）
 */
async function getXingceQuestions(params = {}, cookie) {
    const res = await getXingceQuestionsWithMeta(params, cookie);
    return res.questions;
}

/**
 * 获取申论题库列表
 */
function getEssayQuestions(filterType) {
    if (filterType && filterType !== 'all') {
        return ESSAY_QUESTIONS.filter(q => q.type === filterType);
    }
    return ESSAY_QUESTIONS;
}

// ======================== 粉笔在线申论题库 ========================
// 接口链路（已实测验证）：papers/v2 目录 → POST exercises(type=1,paperId) 创建练习
// → combine/exercise/getExercise 取 staticUrl → combine/static/exercise 取整卷材料与题目
// → api/shenlun/solutions?ids= 取参考答案（无需交卷）。
const SHENLUN_WEB_QUERY = 'app=web&kav=121&av=121&hav=121&version=3.0.0.0';

// 会话内缓存：目录与整卷内容基本不变，避免反复创建练习触发风控
const shenlunCache = {
    papers: null,          // 在线套卷目录（全量）
    papersAt: 0,
    labels: null,          // 考区标签（国考/各省/专项）
    labelsAt: 0,
    labelPapers: new Map(), // labelId -> { papers, total, at }
    papersByKey: new Map(), // paperId -> { questions, at }
    paperById: new Map(),   // paperId -> 目录条目（供直链取卷）
    loadedByPaper: new Map() // paperId -> 已加载题目（跨题型的会话内累积，保留多卷可切换）
};
const SHENLUN_CACHE_TTL = 10 * 60 * 1000;

function stripHtml(html) {
    return String(html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// 题干含“问题/原因/影响”等要素识别题型，与本地五分类对齐
function inferEssayType(content, score) {
    const text = stripHtml(content);
    if (score >= 30 || /写一篇|文章|议论文|自选角度|自拟题目/.test(text)) return { type: 'essay', typeName: '文章写作' };
    if (/短评|倡议书|讲话稿|宣传稿|通知|方案|简报|报道|导言|编者按|公开信|建议书/.test(text)) return { type: 'official_doc', typeName: '公文写作' };
    if (/对策|建议|措施|改进|解决.*问题/.test(text) && !/概括|梳理|归纳/.test(text)) return { type: 'countermeasure', typeName: '提出对策' };
    if (/谈谈.*理解|谈谈.*看法|解释|评析|分析.*观点|认识/.test(text)) return { type: 'analysis', typeName: '综合分析' };
    return { type: 'summary', typeName: '归纳概括' };
}

async function fetchShenlunPapers(cookie) {
    const now = Date.now();
    if (shenlunCache.papers && now - shenlunCache.papersAt < SHENLUN_CACHE_TTL) {
        return shenlunCache.papers;
    }
    // 全量目录按 50/页 并发拉齐（实测 233 套 5 页），页数以首页 pageInfo 为准
    const first = await httpRequest({
        url: `https://tiku.fenbi.com/api/shenlun/papers/v2?toPage=0&pageSize=50&${SHENLUN_WEB_QUERY}`,
        method: 'GET',
        json: true,
        headers: { ...headers, cookie },
        timeout: 8000
    });
    let list = Array.isArray(first && first.list) ? first.list : [];
    const totalPage = Math.min(20, Number(first && first.pageInfo && first.pageInfo.totalPage) || 1);
    if (totalPage > 1) {
        const rest = await Promise.all(
            Array.from({ length: totalPage - 1 }, (_, i) => httpRequest({
                url: `https://tiku.fenbi.com/api/shenlun/papers/v2?toPage=${i + 1}&pageSize=50&${SHENLUN_WEB_QUERY}`,
                method: 'GET',
                json: true,
                headers: { ...headers, cookie },
                timeout: 8000
            }).catch(() => null))
        );
        rest.forEach(r => { if (r && Array.isArray(r.list)) list = list.concat(r.list); });
    }
    list = list.filter(p => p && p.id);
    shenlunCache.papers = list;
    shenlunCache.papersAt = now;
    list.forEach(p => shenlunCache.paperById.set(String(p.id), p));
    return list;
}

/**
 * 考区标签列表（国考/各省/选调生等，实测 37 个）。
 * subLabels.paperIds 与 papers/v2 目录不同域，分组必须走 labelId 查询。
 */
async function fetchShenlunLabels(cookie) {
    const now = Date.now();
    if (shenlunCache.labels && now - shenlunCache.labelsAt < SHENLUN_CACHE_TTL) {
        return shenlunCache.labels;
    }
    const res = await httpRequest({
        url: `https://tiku.fenbi.com/api/shenlun/subLabels?${SHENLUN_WEB_QUERY}`,
        method: 'GET',
        json: true,
        headers: { ...headers, cookie },
        timeout: 8000
    });
    const labels = (Array.isArray(res) ? res : [])
        .filter(l => l && l.id)
        .map(l => ({ id: l.id, name: l.name, paperCount: (l.labelMeta && l.labelMeta.paperCount) || 0 }));
    shenlunCache.labels = labels;
    shenlunCache.labelsAt = now;
    return labels;
}

/**
 * 某考区标签下的套卷目录（分页拉齐，供选卷界面）
 */
async function fetchShenlunLabelPapers(labelId, cookie) {
    const key = String(labelId);
    const cached = shenlunCache.labelPapers.get(key);
    if (cached && Date.now() - cached.at < SHENLUN_CACHE_TTL) {
        return cached.papers;
    }
    const first = await httpRequest({
        url: `https://tiku.fenbi.com/api/shenlun/papers/v2?toPage=0&pageSize=50&labelId=${encodeURIComponent(labelId)}&${SHENLUN_WEB_QUERY}`,
        method: 'GET',
        json: true,
        headers: { ...headers, cookie },
        timeout: 8000
    });
    let list = Array.isArray(first && first.list) ? first.list : [];
    const totalPage = Math.min(20, Number(first && first.pageInfo && first.pageInfo.totalPage) || 1);
    if (totalPage > 1) {
        const rest = await Promise.all(
            Array.from({ length: totalPage - 1 }, (_, i) => httpRequest({
                url: `https://tiku.fenbi.com/api/shenlun/papers/v2?toPage=${i + 1}&pageSize=50&labelId=${encodeURIComponent(labelId)}&${SHENLUN_WEB_QUERY}`,
                method: 'GET',
                json: true,
                headers: { ...headers, cookie },
                timeout: 8000
            }).catch(() => null))
        );
        rest.forEach(r => { if (r && Array.isArray(r.list)) list = list.concat(r.list); });
    }
    list = list.filter(p => p && p.id)
        .map(p => ({ id: p.id, name: p.name, date: p.date || '' }));
    shenlunCache.labelPapers.set(key, { papers: list, at: Date.now() });
    list.forEach(p => shenlunCache.paperById.set(String(p.id), p));
    return list;
}

// 拉取一套完整申论卷（材料+题目+参考答案），拆分为独立题目
async function fetchShenlunPaperQuestions(paper, cookie) {
    const cacheKey = String(paper.id);
    const cached = shenlunCache.papersByKey.get(cacheKey);
    if (cached && Date.now() - cached.at < SHENLUN_CACHE_TTL) {
        return cached.questions;
    }

    // 优先复用未完成练习，避免重复创建
    let combineKey = '';
    const unfinished = await httpRequest({
        url: `https://tiku.fenbi.com/api/shenlun/category-exercises-unfinished?${SHENLUN_WEB_QUERY}`,
        method: 'GET',
        json: true,
        headers: { ...headers, cookie },
        timeout: 6000
    }).catch(() => null);
    if (unfinished && unfinished.combineKey && unfinished.sheetType === 1) {
        // 仅当未完成练习就是目标卷时复用；否则新建
        const exCheck = await httpRequest({
            url: `https://tiku.fenbi.com/combine/exercise/getExercise?format=html&key=${unfinished.combineKey}&routecs=shenlun&${SHENLUN_WEB_QUERY}`,
            method: 'GET',
            json: true,
            headers: { ...headers, cookie },
            timeout: 8000
        }).catch(() => null);
        const checkData = exCheck && (exCheck.data || exCheck);
        if (checkData && checkData.name === paper.name) {
            combineKey = unfinished.combineKey;
        }
    }
    if (!combineKey) {
        const created = await httpRequest({
            url: `https://tiku.fenbi.com/api/shenlun/exercises?${SHENLUN_WEB_QUERY}`,
            method: 'POST',
            body: `type=1&paperId=${encodeURIComponent(paper.id)}&exerciseTimeMode=2`,
            json: true,
            headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', cookie },
            timeout: 10000
        });
        combineKey = created && created.key;
    }
    if (!combineKey) return [];

    const ex = await httpRequest({
        url: `https://tiku.fenbi.com/combine/exercise/getExercise?format=html&key=${combineKey}&routecs=shenlun&${SHENLUN_WEB_QUERY}`,
        method: 'GET',
        json: true,
        headers: { ...headers, cookie },
        timeout: 8000
    });
    const exData = ex && (ex.data || ex);
    const staticUrl = exData && exData.staticUrl && exData.staticUrl.urls && exData.staticUrl.urls[0];
    if (!staticUrl) return [];

    const full = await httpRequest({
        url: `${staticUrl}&routecs=shenlun&type=1&${SHENLUN_WEB_QUERY}`,
        method: 'GET',
        json: true,
        headers: { ...headers, cookie },
        timeout: 15000
    });
    const rawQuestions = Array.isArray(full && full.questions) ? full.questions : [];
    const rawMaterials = Array.isArray(full && full.materials) ? full.materials : [];
    if (rawQuestions.length === 0) return [];

    // materialIndexes(数字) 与 materials[].globalId(字符串) 不同域，
    // 按 card 顺序对齐：第 i 个题节点的 materialKeys 对应第 i 题引用的材料。
    // 材料在整卷中的序号即“给定资料N”，必须随题目带到前端，避免重新编号导致题干与材料错位。
    const materialByGlobalId = new Map(rawMaterials.map((m, idx) => [m.globalId, {
        ordinal: idx + 1,
        content: stripHtml(m.content)
    }]));
    const materialByOrdinal = new Map([...materialByGlobalId.values()].map(m => [m.ordinal, m]));
    const cardNodes = ((full.card && full.card.children) || [])
        .flatMap(ch => ch.children || [])
        .filter(n => n && n.nodeType === 2);

    const qids = rawQuestions.map(q => q.id).filter(Boolean);
    const solutions = qids.length > 0
        ? await httpRequest({
            url: `https://tiku.fenbi.com/api/shenlun/solutions?ids=${qids.join(',')}&app=web`,
            method: 'GET',
            json: true,
            headers: { ...headers, cookie },
            timeout: 10000
        }).catch(() => [])
        : [];
    const solutionById = new Map((Array.isArray(solutions) ? solutions : []).filter(Boolean).map(s => [s.id, s]));

    const questions = rawQuestions.map((q, idx) => {
        const acc = (q.accessories && q.accessories[0]) || {};
        const score = Number(acc.score) || 20;
        const wordCount = Number(acc.wordCount) || 300;
        const { type, typeName } = inferEssayType(q.content, score);
        const keys = (cardNodes[idx] && cardNodes[idx].materialKeys) || [];
        // 按题干引用顺序保留真实材料序号（如资料1-3、资料8、大作文全篇），
        // 而非 filtered 后重新从1编号，确保“给定资料N”与题干一致。
        const orderedKeys = keys.length > 0 ? keys : rawMaterials.map(m => m.globalId);
        const materials = orderedKeys
            .map(k => materialByGlobalId.get(k))
            .filter(Boolean)
            .sort((a, b) => a.ordinal - b.ordinal);
        const sol = solutionById.get(q.id);
        const refAcc = sol && (sol.solutionAccessories || []).find(a => a && a.label === 'reference');
        const contentText = stripHtml(q.content);
        // 题干第一段为问题，其余为作答要求
        const lines = contentText.split('\n').map(s => s.trim()).filter(Boolean);
        return {
            id: `fb-${q.id}`,
            paperId: String(paper.id),
            type,
            typeName,
            examName: paper.name,
            title: lines[0] || contentText,
            requirement: lines.slice(1).join(' ') || `不超过${wordCount}字`,
            maxScore: score,
            maxWords: wordCount,
            materials: materials.length > 0 ? materials : [...materialByOrdinal.values()].sort((a, b) => a.ordinal - b.ordinal),
            standardAnswer: refAcc ? stripHtml(refAcc.content) : '',
            scoringPoints: [],
            online: true
        };
    }).filter(q => q.materials.length > 0);

    shenlunCache.papersByKey.set(cacheKey, { questions, at: Date.now() });
    shenlunCache.loadedByPaper.set(cacheKey, questions);
    return questions;
}

/**
 * 获取申论题库列表（含在线套卷，与行测同模式：在线优先，本地兜底）
 * opts.paperId 指定展开的在线卷；缺省取目录最新一套
 */
async function getEssayQuestionsWithMeta(filterType, cookie, opts = {}) {
    let onlineQuestions = [];
    let sourceMode = 'local_no_cookie';
    let sourceMessage = '当前未检测到粉笔登录 Cookie，已加载本地精选真题库（如需同步粉笔在线套卷，请前往配置中心导入）。';
    let activePaperId = '';

    if (cookie) {
        try {
            let paper = null;
            if (opts.paperId) {
                // 选卷直链：优先目录缓存，未命中时按 labelId 查询过的条目兜底
                paper = shenlunCache.paperById.get(String(opts.paperId)) || null;
                if (!paper) {
                    const papers = await fetchShenlunPapers(cookie);
                    paper = papers.find(p => String(p.id) === String(opts.paperId)) || null;
                }
                if (!paper) {
                    // 不在默认目录的卷（如小模考/各省专项）：仅凭 id 也可创建练习
                    paper = { id: opts.paperId, name: '' };
                }
            } else {
                const papers = await fetchShenlunPapers(cookie);
                paper = papers[0] || null;
            }
            if (paper) {
                onlineQuestions = await fetchShenlunPaperQuestions(paper, cookie);
                if (onlineQuestions.length > 0 && !paper.name) {
                    paper.name = onlineQuestions[0].examName;
                }
            }
            if (onlineQuestions.length > 0) {
                activePaperId = String(paper.id);
                sourceMode = 'online';
                sourceMessage = `已连接粉笔在线题库（${paper.name || '所选套卷'}，共 ${onlineQuestions.length} 题），并保留本地精选真题。`;
            } else {
                sourceMode = 'local_empty';
                sourceMessage = '粉笔账号下暂未拉取到所选在线申论套卷（可能 Cookie 已过期或接口受限），已自动切换为本地精选真题库。';
            }
        } catch (e) {
            console.warn('Fetch online shenlun papers failed, falling back to local dataset:', e.message || e);
            sourceMode = 'local_fallback';
            sourceMessage = `粉笔在线题库拉取失败（${e.message || e}），已自动降级为本地精选真题库。`;
        }
    }

    // 当前卷题目优先，其后拼接会话内已加载过的其他卷题目（按题 id 去重），
    // 保证下拉框可在多套卷之间切换，而不必每次重新选卷。
    let all = [];
    const seen = new Set();
    const addUnique = list => list.forEach(q => {
        if (q && q.id && !seen.has(q.id)) {
            seen.add(q.id);
            all.push(q);
        }
    });
    addUnique(onlineQuestions);
    for (const [paperId, loaded] of shenlunCache.loadedByPaper) {
        if (paperId !== activePaperId) addUnique(loaded);
    }
    addUnique(ESSAY_QUESTIONS);
    if (filterType && filterType !== 'all') {
        all = all.filter(q => q.type === filterType);
    }
    const loadedPapers = [...shenlunCache.loadedByPaper.keys()].map(pid => {
        const p = shenlunCache.paperById.get(pid);
        return { id: pid, name: (p && p.name) || (shenlunCache.loadedByPaper.get(pid)[0] || {}).examName || pid };
    });
    return { questions: all, sourceMode, sourceMessage, activePaperId, loadedPapers };
}

/**
 * 获取单道申论题目详情（支持在线题 fb- 前缀，在线题从缓存取）
 */
function getEssayQuestionById(id) {
    const local = ESSAY_QUESTIONS.find(q => q.id === id);
    if (local) return local;
    for (const entry of shenlunCache.papersByKey.values()) {
        const found = entry.questions.find(q => q.id === id);
        if (found) return found;
    }
    return null;
}

module.exports = {
    getXingceCategories,
    getXingceQuestions,
    getXingceQuestionsWithMeta,
    getEssayQuestions,
    getEssayQuestionsWithMeta,
    getEssayQuestionById,
    fetchShenlunPapers,
    fetchShenlunLabels,
    fetchShenlunLabelPapers
};
