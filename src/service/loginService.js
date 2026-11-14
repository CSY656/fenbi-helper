const fs = require('fs');
const path = require('path');
const request = require('request');
const setCookie = require('set-cookie-parser');

function getSessionFile() {
    const dataDir = process.env.FENBI_DATA_DIR || path.join(__dirname, '../../data');
    return path.join(dataDir, 'fenbi_session.json');
}

exports.loadSession = function () {
    const file = getSessionFile();
    try {
        if (fs.existsSync(file)) {
            const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
            if (parsed && typeof parsed.cookie === 'string' && parsed.cookie.trim()) {
                return {
                    cookie: parsed.cookie.trim(),
                    user: parsed.user || null
                };
            }
        }
    } catch (e) {
        console.error('Load fenbi session error:', e);
    }
    return { cookie: '', user: null };
};

exports.saveSession = function (cookie, user) {
    const file = getSessionFile();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify({
        cookie: cookie || '',
        user: user || null,
        updatedAt: new Date().toISOString()
    }, null, 2), 'utf-8');
};

exports.clearSession = function () {
    const file = getSessionFile();
    try {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    } catch (e) {
        console.error('Clear fenbi session error:', e);
    }
};

function queryString(n) {
    let t = '';
    for (let e in n) {
        if (n[e] !== undefined && n[e] !== null) {
            t += e + '=' + encodeURIComponent(n[e]) + '&';
        }
    }
    return t.slice(0, -1);
}

/**
 * 将浏览器复制出来的 raw cookie 字符串解析为数组 [{name, value}]
 */
exports.parseRawCookie = function (rawCookie) {
    if (!rawCookie || typeof rawCookie !== 'string') return [];
    let items = [];
    let parts = rawCookie.split(';');
    for (let part of parts) {
        let trimmed = part.trim();
        if (!trimmed) continue;
        let eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            let name = trimmed.substring(0, eqIdx).trim();
            let value = trimmed.substring(eqIdx + 1).trim();
            if (name) {
                items.push({ name, value });
            }
        }
    }
    return items;
};

/**
 * 校验给定的 Cookie 字符串是否能在粉笔题库正常获取用户信息
 */
exports.validateCookie = async function (cookieStr) {
    return new Promise((resolve) => {
        request({
            url: 'https://tiku.fenbi.com/api/users/me',
            method: 'GET',
            json: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'cookie': cookieStr
            },
            timeout: 8000
        }, function (err, httpResponse, body) {
            if (err) {
                return resolve({ valid: false, message: '请求粉笔服务器失败: ' + (err.message || err) });
            }
            if (httpResponse && (httpResponse.statusCode === 200 || httpResponse.statusCode === 304)) {
                if (body && (body.id || body.nick || body.avatar)) {
                    return resolve({ valid: true, user: body });
                }
            }
            // 部分情况下 users/me 可能受限，尝试拿练习分类测试
            request({
                url: 'https://tiku.fenbi.com/api/xingce/categories?filter=keypoint&app=web&kav=12&version=3.0.0.0',
                method: 'GET',
                json: true,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'cookie': cookieStr
                },
                timeout: 8000
            }, function (err2, res2, body2) {
                if (!err2 && res2 && res2.statusCode === 200 && Array.isArray(body2) && body2.length > 0) {
                    return resolve({ valid: true, user: { nick: '粉笔用户' } });
                }
                return resolve({
                    valid: false,
                    message: 'Cookie 无效或已过期，请重新登录粉笔官网并复制最新 Cookie'
                });
            });
        });
    });
};

/**
 * 账号密码登录（粉笔旧版接口，若官方加防可能会失败）
 */
exports.login = async function (phone, password, captcha) {
    let loginBody = {
        phone,
        password
    };
    if (captcha != null && captcha !== '') {
        loginBody.captcha = captcha;
    }

    return await new Promise(function (resolve, reject) {
        request({
            url: 'https://tiku.fenbi.com/api/users/loginV2',
            method: 'POST',
            json: true,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: queryString(loginBody),
            timeout: 10000
        }, function (err, httpResponse, body) {
            if (err) return reject(err);
            if (!httpResponse || !httpResponse.headers || !httpResponse.headers['set-cookie']) {
                return resolve([]);
            }
            resolve(setCookie.parse(httpResponse.headers['set-cookie']));
        });
    });
};
