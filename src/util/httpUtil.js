const request = require('request');

const ERR_CODE = 666;

exports.httpRequest = async function (params) {
    try {
        return await new Promise(function (resolve, reject) {
            request(params, function (err, httpResponse, body) {
                if (err) {
                    return reject(err);
                }
                if (httpResponse && httpResponse.statusCode >= 400) {
                    const httpErr = new Error(`HTTP ${httpResponse.statusCode} from ${params.url}`);
                    httpErr.statusCode = httpResponse.statusCode;
                    httpErr.body = body;
                    return reject(httpErr);
                }
                return resolve(body);
            });
        });
    } catch (error) {
        if (error.code === 'ETIMEDOUT') {
            throw {
                code: 'ETIMEDOUT',
                message: `请求${params.url}服务超时`,
                value: JSON.stringify(error),
            };
        }
        if (error.statusCode) {
            throw {
                code: error.statusCode,
                statusCode: error.statusCode,
                message: `请求${params.url}返回异常状态 ${error.statusCode}`,
                value: typeof error.body === 'string' ? error.body : JSON.stringify(error.body || ''),
            };
        }
        if (error.connect === true) {
            throw {
                code: ERR_CODE,
                message: `无法连接${params.url}服务`,
                value: JSON.stringify(error),
            };
        }
        throw {
            code: ERR_CODE,
            message: `请求${params.url}服务出错`,
            value: error.message,
        };
    }
};