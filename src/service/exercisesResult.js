const _ = require('lodash');
const moment = require('moment');
const qs = require('querystring');
const crypto = require('crypto');
const percentile = require('percentile');

const {httpRequest} = require('../util/httpUtil');

const HISTORY_CACHE_TTL_MS = 3 * 60 * 1000;
const exerciseHistoryCache = new Map();

async function mapWithConcurrency(items, limit, worker) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const results = new Array(items.length);
    let cursor = 0;
    const workerCount = Math.max(1, Math.min(limit || 6, items.length));

    async function run() {
        while (cursor < items.length) {
            const idx = cursor++;
            results[idx] = await worker(items[idx], idx);
        }
    }

    await Promise.all(Array.from({ length: workerCount }, () => run()));
    return results;
}

function getCacheKey(cookie) {
    return crypto.createHash('sha256').update(cookie || '').digest('hex');
}

let headers = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "accept-language": "zh-CN,zh-TW;q=0.9,zh;q=0.8",
    "cache-control": "max-age=0",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1"
};

async function getCategories(group, cookie) {
    try {
        let category = await httpRequest({
            url: `https://tiku.fenbi.com/api/xingce/categories?filter=keypoint&app=web&kav=12&version=3.0.0.0`,
            method: "GET",
            json: true,
            headers: {
                ...headers,
                cookie
            }
        });
        let rels = [];
        if (Array.isArray(category)) {
            buildCat(category, rels, group);
        }

        let othersList = group['others'] || [];
        rels.push({
            type: '试卷',
            items: othersList.filter(i => i && i.answerCount > 30),
            childTypes: []
        });

        calcCount(rels);
        return rels;
    } catch (e) {
        console.error('getCategories error:', e.message);
        return [{
            type: '练习记录',
            items: _.flatMap(Object.values(group)),
            childTypes: [],
            count: _.flatMap(Object.values(group)).reduce((sum, item) => sum + (item.answerCount || 0), 0)
        }];
    }
}

function buildCat(cats, roots, group) {
    if (!cats || cats.length === 0) return;
    for (let cat of cats) {
        if (!cat || !cat.name) continue;
        let name = cat.name.split('-')[0];
        let obj = {
            type: name,
            childTypes: [],
            items: [],
        };
        buildCat(cat.children, obj.childTypes, group);
        if (!roots.map(i => i.type).includes(name)) {
            obj.items = group[name] || [];
            roots.push(obj);
        }
    }
}

function sum (arr) {
    return arr.reduce((a, b) => a + b, 0);
}

function _buildCount(root) {
    if (!root) return 0;
    let items = root.items || [];
    let childTypes = root.childTypes || [];
    let count = sum(items.map(i => (i && i.answerCount) || 0)) + sum(childTypes.map(t => _buildCount(t)));
    root.count = count;
    return count;
}

function calcCount(roots) {
    if (!roots || roots.length === 0) return;
    for (let root of roots) {
        _buildCount(root);
    }
}

let cleanTitle = function (title) {
    if (!title) return "无来源";
    return title.replace(/辽宁\/湖南\/湖北\/安徽\/四川\/福建\/云南\/黑龙江\/江西\/广西\/贵州\/海南\/内蒙古\/山西\/重庆\/宁夏\/西藏/g, '湖北')
        .replace(/山西\/辽宁\/黑龙江\/福建\/湖北\/ 湖南\/广西\/海南\/四川\/重庆\/ 云南\/ 西藏\/陕西\/青海\/宁夏\/ 新疆兵团/g, '湖北')
        .replace(/贵州\/四川\/福建\/黑龙江\/湖北\/山西\/重庆\/辽宁\/海南\/江西\/天津\/陕西\/云南\/广西\/山东\/湖南/g, '湖北')
        .replace(/（网友回忆版）/g, '')
        .replace(/网友回忆版/g, '')
        .replace(/第\d+题/g, '')
        .replace(/县级\+乡镇/g, '县级');
}

async function getQuestionByIds(questionIds) {
    if (!questionIds || questionIds.length === 0) return {};
    let questions = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/questions?ids=${questionIds.join(',')}`,
        method: "GET",
        json: true,
        headers
    });
    if (!Array.isArray(questions)) return {};
    return _.zipObject(questions.map(q => q.id), questions);
}

async function getQuestionMetaByIds(questionIds) {
    if (!questionIds || questionIds.length === 0) return {};
    let questions = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/question/meta?ids=${questionIds.join(',')}`,
        method: "GET",
        json: true,
        headers
    });
    if (!Array.isArray(questions)) return {};
    return _.zipObject(questions.map(q => q.id), questions);
}

async function getQuestionKeyPointsByIds(questionIds) {
    if (!questionIds || questionIds.length === 0) return {};
    let questions = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/solution/keypoints?ids=${questionIds.join(',')}`,
        method: "GET",
        json: true,
        headers
    });
    return _.zipObject(questionIds, questions);
}

// 返回收藏了的题目的id数组
async function getCollectsByIds(questionIds, cookie) {
    if (!questionIds || questionIds.length === 0) return [];
    try {
        let result = await httpRequest({
            url: `https://tiku.fenbi.com/api/xingce/collects?ids=${questionIds.join(',')}`,
            method: "GET",
            json: true,
            headers: {
                ...headers,
                cookie
            }
        });
        return Array.isArray(result) ? result : [];
    } catch (e) {
        return [];
    }
}

function getExerciseReport(exerciseId, cookie) {
    return httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/exercises/${exerciseId}/report/v2`,
        method: "GET",
        json: true,
        headers: {
            ...headers,
            cookie
        }
    }).catch(() => null);
}

function getExercise(exerciseId, cookie) {
    return httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/exercises/${exerciseId}`,
        method: "GET",
        json: true,
        headers: {
            ...headers,
            cookie
        }
    }).catch(() => null);
}

async function getExerciseHistoryList(categoryId, cookie) {
    let cursorArr = [0, 30];
    let hisArr = await Promise.all(cursorArr.map(cursor => {
        return httpRequest({
            url: `https://tiku.fenbi.com/api/xingce/category-exercises?categoryId=${categoryId}&cursor=${cursor}&count=30`,
            method: "GET",
            json: true,
            headers: {
                ...headers,
                cookie
            }
        }).catch(() => null);
    }));
    return _.flatMap(hisArr.filter(a => a && a.datas), his => his.datas);
}

async function getSolutionsByIds(questionIds, cookie) {
    if (!questionIds || questionIds.length === 0) return {};
    try {
        let questions = await httpRequest({
            url: `https://tiku.fenbi.com/api/xingce/solutions?ids=${questionIds.join(',')}`,
            method: "GET",
            json: true,
            headers: {
                ...headers,
                cookie
            }
        });
        if (!Array.isArray(questions)) return {};
        return _.zipObject(questionIds, questions);
    } catch (e) {
        return {};
    }
}

async function getEpisodesByIds(questionIds, cookie) {
    if (!questionIds || questionIds.length === 0) return {};
    try {
        let result = await httpRequest({
            url: `https://ke.fenbi.com/api/gwy/v3/episodes/tiku_episodes_with_multi_type?tiku_ids=${questionIds.join(',')}&tiku_prefix=xingce&tiku_type=5`,
            method: "GET",
            json: true,
            headers: {
                ...headers,
                cookie
            }
        });
        return (result && result.data) || {};
    } catch (e) {
        return {};
    }
}

function parseWordListFromNote2(content) {
    if (!content) return [];
    let lines = content.split('\n');
    let wdList = lines.map(wl => {
        let reg = /.*\[!([^\]]*)\].*/g;
        if (wl.match(reg)) {
            return wl.replace(reg, '$1');
        }
    }).filter(a => a);
    return wdList.filter(a => a.length <= 5);
}

function parseWordListFromNote1(content) {
    if (!content) return [];
    let lines = content.split('\n');
    let s = lines.indexOf('[start积累]');
    let e = lines.indexOf('[end积累]');
    if (s !== -1 && e !== -1) {
        lines = lines.slice(s + 1, e).filter(a => a);
        let wdList = lines.map(wl => {
            let w = wl.replace(/.*\* \[?([^\]]*)\]?\[?[^\[\]]*\]?[：|:].*/g, '$1');
            return w;
        });
        return wdList.filter(a => a.length <= 5);
    } else {
        return [];
    }
}

function parseWordListFromNote(content) {
    return parseWordListFromNote1(content).concat(parseWordListFromNote2(content));
}

function parseTagListFromNote(content) {
    if (!content) return [];
    let lines = content.split('\n').filter(a => a);
    let wdList = lines.map(wl => {
        if (wl.match(/^\{(.*)\}$/g)) {
            let w = wl.replace(/^\{(.*)\}$/g, '$1');
            return w;
        }
    }).filter(a => a);
    return wdList;
}

exports.zjWord = async function (word) {
    try {
        let result = await httpRequest({
            url: `https://zaojv.com/wordQueryDo.php`,
            method: "POST",
            headers: {
                ...headers,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: qs.stringify({
                nsid: 0,
                s: 45957424262910633321,
                wo: word,
                directGo: 1
            })
        });
        return "https://zaojv.com/" + (result || '').replace(/\n/g, "").replace(/(.*)HREF="(.*)".*/g, '$2');
    } catch (e) {
        return `https://www.baidu.com/s?wd=${encodeURIComponent(word)}`;
    }
};

exports.saveNote = async function (questionId, content, cookie) {
    let result = await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/notes`,
        method: "POST",
        headers: {
            ...headers,
            'Content-Type': 'application/json;charset=UTF-8',
            cookie
        },
        body: JSON.stringify({
            content,
            questionId: Number.parseInt(questionId)
        })
    });
    if (!result) {
        throw new Error('save note error!');
    }
    return result;
};

let getNotesMapByIds = async function (questionIds, cookie) {
    if (!questionIds || questionIds.length === 0) return {};
    try {
        let params = qs.stringify({
            questionIds: questionIds.join(',')
        });
        let result = await httpRequest({
            url: `https://tiku.fenbi.com/api/xingce/notes?` + params,
            method: "GET",
            headers: {
                ...headers,
                'Content-Type': 'application/json;charset=UTF-8',
                cookie
            },
            json: true,
        });
        if (!Array.isArray(result)) return {};
        result = result.filter(a => a);
        return _.zipObject(result.map(r => r.questionId), result.map(r => r.content));
    } catch (e) {
        return {};
    }
};

exports.mapWithConcurrency = mapWithConcurrency;

exports.getExerciseHistory = async function (cookie, options = {}) {
    const cacheKey = getCacheKey(cookie);
    const cached = exerciseHistoryCache.get(cacheKey);
    if (!options.forceRefresh && cached && (Date.now() - cached.ts) < HISTORY_CACHE_TTL_MS) {
        return cached.data;
    }

    let result = await Promise.all([
        getExerciseHistoryList(1, cookie),
        getExerciseHistoryList(3, cookie)
    ]);
    let exerciseHistory = _.orderBy(_.flatMap(result, _.identity).filter(Boolean), ['updatedTime'], ['desc']);
    let reports = await mapWithConcurrency(exerciseHistory, 6, item => getExerciseReport(item.id, cookie));
    let exerciseReportMap = _.zipObject(
        exerciseHistory.map(item => item.id),
        reports
    );

    exerciseHistory.forEach(history => {
        history.finishedTime = moment(history.updatedTime).format('YYYY-MM-DD HH:mm:ss');
        history.finishedDate = moment(history.updatedTime).format('YYYY-MM-DD');
        let report = exerciseReportMap[history.id];
        if (report) {
            history.elapsedTime = report.elapsedTime || 0;
            history.answerCount = report.answerCount || 0;
            history.correctRate = report.answerCount > 0
                ? (report.correctCount / report.answerCount * 100).toFixed(1)
                : '0.0';
        } else {
            history.elapsedTime = 0;
            history.answerCount = 0;
            history.correctRate = '0.0';
        }
    });

    exerciseHistory = exerciseHistory.filter(h => h.status === 1 && h.answerCount > 0);
    let exerciseHistoryGroup = _.groupBy(exerciseHistory, h => {
        let name = (h.sheet && h.sheet.name) || '';
        if (name.startsWith('专项智能练习')) {
            h.cleanName = name.replace(/(专项智能练习)（(.*)）/, '$1');
            return name.replace(/专项智能练习（(.*)）/, '$1');
        } else {
            h.cleanName = cleanTitle(name);
            return 'others';
        }
    });

    let groupItems = await getCategories(exerciseHistoryGroup, cookie);
    let exerciseHeatMapData = {};

    exerciseHistory.forEach(h => {
        let v = moment(h.finishedDate).toDate().getTime() / 1000;
        exerciseHeatMapData[v] = (exerciseHeatMapData[v] || 0) + h.answerCount;
    });

    const data = {
        groupItems,
        exerciseHeatMapData,
        exerciseHistoryGroup,
        exerciseHistory,
        cleanTitle,
        moment
    };

    exerciseHistoryCache.set(cacheKey, { ts: Date.now(), data });
    if (exerciseHistoryCache.size > 20) {
        const oldestKey = exerciseHistoryCache.keys().next().value;
        exerciseHistoryCache.delete(oldestKey);
    }

    return data;
};

exports.getQuestion = async function (questionId, cookie) {
    let solutionMap = await getSolutionsByIds([questionId], cookie);
    let notesMap = await getNotesMapByIds([questionId], cookie);
    let collectionIds = await getCollectsByIds([questionId], cookie);
    let q = solutionMap[questionId] || {};

    if (notesMap[questionId]) {
        q.note = notesMap[questionId];
        q.wordList = parseWordListFromNote(q.note);
    } else {
        q.note = '';
        q.wordList = [];
    }

    q.hasCollect = collectionIds.some(qid => qid === q.id);
    q.keypoints = (q.keypoints || []).map(i => (typeof i === 'string' ? i : (i && i.name ? i.name : ''))).filter(Boolean);
    q.tags = (q.tags || []).map(i => (typeof i === 'string' ? i : (i && i.name ? i.name : ''))).filter(Boolean);

    let qMeta = q.questionMeta || {};
    q.mostWrongAnswer = qMeta.mostWrongAnswer || '';
    q.correctRatio = typeof qMeta.correctRatio === 'number' ? qMeta.correctRatio : 0;
    q.totalCount = qMeta.totalCount || 0;

    q.options = (q.accessories && q.accessories[0] && q.accessories[0].options) || [];
    if (q.material && typeof q.material === 'object') {
        q.material = q.material.content || '';
    }

    return {
        q,
    };
};

exports.getResultObj = async function (exerciseId, costThreshold, cookie) {
    let [exercise, report] = await Promise.all([
        getExercise(exerciseId, cookie),
        getExerciseReport(exerciseId, cookie)
    ]);
    if (!report || !report.answers || !exercise) return null;
    let collectionIds = await getCollectsByIds(report.answers.map(answer => answer.questionId), cookie);

    let answerResultMap = {};

    report.answers.forEach(answer => {
        if (answer.status !== 10 || collectionIds.includes(answer.questionId)) {
            answerResultMap[answer.questionId] = answer.correct;
        }
    });

    let userAnswers = exercise.userAnswers || {};
    let concernQuestions = Object.keys(answerResultMap).map(questionId => {
        let ua = Object.values(userAnswers).find(item => item && item.questionId == questionId);
        let correct = answerResultMap[questionId];
        let idx = (ua && (ua.questionIndex + 1)) || (report.answers.findIndex(item => item.questionId == questionId) + 1);
        let choiceIndex = ua && ua.answer && typeof ua.answer.choice === 'number' ? ua.answer.choice : -1;
        return {
            idx: idx,
            questionId,
            correct,
            cost: ua && ua.time ? ua.time : 0,
            myAnswer: (choiceIndex >= 0 && choiceIndex < 4) ? ['A', 'B', 'C', 'D'][choiceIndex] : '未选择'
        };
    }).filter(a => a);

    let solutionMap = await getSolutionsByIds(concernQuestions.map(q => q.questionId), cookie);
    let notesMap = await getNotesMapByIds(concernQuestions.map(q => q.questionId), cookie);

    concernQuestions = _.orderBy(concernQuestions, ['correct', 'cost', 'idx'], ['asc', 'desc', 'asc']);

    let concernSource = ['国家', '联考', '省', '市'];
    let concernSourceCountMap = {};
    concernQuestions.forEach(q => {
        let solutionObj = solutionMap[q.questionId] || {};
        q.content = solutionObj.content || '';
        q.options = (solutionObj.accessories && solutionObj.accessories[0] && solutionObj.accessories[0].options) || [];
        q.difficulty = solutionObj.difficulty;
        q.correctAnswer = solutionObj.correctAnswer;
        q.source = solutionObj.source || '未知来源';

        concernSource.some(item => {
            if (q.source && q.source.includes(item)) {
                concernSourceCountMap[item] = (concernSourceCountMap[item] || 0) + 1;
                return true;
            }
            return false;
        });

        q.hasCollect = collectionIds.some(qid => qid == q.questionId);

        // 标签与知识点安全防御
        q.keypoints = (solutionObj.keypoints || []).map(i => (typeof i === 'string' ? i : (i && i.name ? i.name : ''))).filter(Boolean);
        q.tags = (solutionObj.tags || []).map(i => (typeof i === 'string' ? i : (i && i.name ? i.name : ''))).filter(Boolean);

        q.solution = solutionObj.solution || '';

        let qMeta = solutionObj.questionMeta || {};
        q.mostWrongAnswer = qMeta.mostWrongAnswer || '';
        q.correctRatio = typeof qMeta.correctRatio === 'number' ? qMeta.correctRatio : 0;
        q.totalCount = qMeta.totalCount || 0;

        if (notesMap[q.questionId]) {
            q.note = notesMap[q.questionId];
            q.wordList = parseWordListFromNote(q.note);
            q.tagList = parseTagListFromNote(q.note);
        } else {
            q.note = '';
            q.wordList = [];
            q.tagList = [];
        }

        if (solutionObj.material && typeof solutionObj.material === 'object') {
            q.material = solutionObj.material.content || '';
        } else {
            q.material = '';
        }
    });

    let costArr = concernQuestions.map(a => ({
        idx: a.idx,
        cost: a.cost,
        correctRatio: a.correctRatio,
        correct: a.correct
    })).filter(a => a.cost > 0);

    let safePercentile = (p, arr) => {
        if (!arr || arr.length === 0) return 0;
        try {
            return percentile(p, arr) || 0;
        } catch (e) {
            return 0;
        }
    };

    let safeAvg = arr => {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((p, c) => p + c, 0) / arr.length;
    };

    return {
        moment,
        exercise,
        cleanTitle,
        costThreshold,
        concernSourceCount: Object.keys(concernSourceCountMap).map(key => ({key, count: concernSourceCountMap[key]})),
        concernQuestions,
        costArr: _.orderBy(costArr, ['idx'], ['asc']),
        percentile: safePercentile,
        avg: safeAvg,
    };
};

exports.addCollect = async function (questionId, cookie) {
    return await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/collects/${questionId}`,
        method: "POST",
        headers: {
            ...headers,
            cookie
        },
        body: null
    });
};

exports.delCollect = async function (questionId, cookie) {
    await httpRequest({
        url: `https://tiku.fenbi.com/api/xingce/collects/${questionId}`,
        method: "DELETE",
        headers: {
            ...headers,
            cookie
        }
    });
};

exports.getVideoUrl = async function (questionId, cookie) {
    try {
        let episodeMap = await getEpisodesByIds([questionId], cookie);
        if (episodeMap[questionId] && episodeMap[questionId].length > 0) {
            let videoResult = await httpRequest({
                url: `https://ke.fenbi.com/api/gwy/v3/episodes/${episodeMap[questionId][0].id}/mediafile/meta`,
                method: "GET",
                headers: {
                    ...headers,
                    cookie
                },
                json: true
            });
            if (videoResult && videoResult.datas && videoResult.datas.length > 0) {
                return _.orderBy(videoResult.datas, ['realSize'], ['desc'])[0].url;
            }
        }
        return null;
    } catch (e) {
        return null;
    }
};

exports.getComments = async function (questionId, cookie) {
    try {
        let episodeMap = await getEpisodesByIds([questionId], cookie);
        if (!episodeMap[questionId] || episodeMap[questionId].length === 0) return [];
        let cursorArr = [0, 30];
        let commentResultArr = await Promise.all(cursorArr.map(cursor => {
            return httpRequest({
                url: `https://ke.fenbi.com/ipad/gwy/v3/comments/episodes/${episodeMap[questionId][0].id}?system=12.4.7&inhouse=0&app=gwy&ua=iPad&av=44&version=6.11.3&kav=22&kav=1&len=30&start=${cursor}`,
                method: "GET",
                json: true,
                headers: {
                    ...headers,
                    cookie
                }
            }).catch(() => null);
        }));
        let datas = _.flatMap(commentResultArr.filter(a => a && a.datas), r => r.datas);
        return _.orderBy(datas.filter(i => {
            return i && i.likeCount > 1 && !['?', '？'].some(t => (i.comment || '').includes(t)) && (i.comment || '').length > 8;
        }), ['likeCount'], ['desc']).slice(0, 10);
    } catch (e) {
        return [];
    }
};

function convertTree(root) {
    if (!root) return '';
    let str = '';
    let children = root.children || [];
    for (let child of children) {
        if (!child) continue;
        if (child.name === 'em') {
            str += '<span class="searchKeyword">' + convertTree(child) + '</span>';
        } else if (child.name === 'txt') {
            str += child.value || '';
        } else if (child.name === 'p') {
            str += convertTree(child);
        }
    }
    return str;
}

exports.search = async function (text, cookie) {
    try {
        let cursorArr = [0, 15];
        let commentResultArr = await Promise.all(cursorArr.map(cursor => {
            return httpRequest({
                url: `https://tiku.fenbi.com/ipad/search/v2?system=12.4.7&inhouse=0&app=gwy&ua=iPad&av=44&version=6.11.3&kav=22&coursePrefix=xingce&format=json&len=15&q=${encodeURIComponent(text)}&start=${cursor}`,
                method: "GET",
                json: true,
                headers: {
                    ...headers,
                    'User-Agent': 'XC/6.11.3 (iPad; iOS 12.4.7; Scale/2.00)',
                    'Accept': '*/*',
                    cookie
                }
            }).catch(() => null);
        }));
        let datas = _.flatMap(commentResultArr.filter(a => a), r => _.get(r, 'data.items', []));

        datas.forEach(item => {
            let sourceList = (item.source || '').split(',');
            item.sourceList = sourceList.filter(s => {
                let blockSourceList = ['礼包', '模考'];
                return !blockSourceList.some(b => s.includes(b));
            });
        });
        datas = datas.filter(item => item.sourceList && item.sourceList.length !== 0);
        datas.forEach(item => {
            try {
                item.stemSnippet_ = convertTree(JSON.parse(item.stemSnippet));
            } catch (err) {
                item.stemSnippet_ = item.stemSnippet || '';
            }
        });
        return datas;
    } catch (e) {
        console.error('search error:', e);
        return [];
    }
};
