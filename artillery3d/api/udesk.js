const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// 注意这里改成了 module.exports，这是 100% 兼容的 Node.js 写法
module.exports = async (req, res) => {
    // 1. 强制写入跨域允许头 (CORS) - 这一步必须在最前面！
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // 允许所有域名访问
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // 2. 拦截并立刻放行浏览器的“探路请求” (OPTIONS)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 3. 拦截非 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只允许 POST 请求' });
    }

    try {
        const shopifyData = req.body; 

        // 读取环境变量
        const UDESK_EMAIL = process.env.UDESK_EMAIL;
        const UDESK_API_TOKEN = process.env.UDESK_API_TOKEN;
        const UDESK_DOMAIN = process.env.UDESK_DOMAIN;

        // 如果没有配置环境变量，立刻报错返回，方便你排查
        if (!UDESK_EMAIL || !UDESK_API_TOKEN || !UDESK_DOMAIN) {
             return res.status(500).json({ error: 'Vercel 环境变量未配置齐全' });
        }

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = uuidv4();
        const sign_version = 'v2';
        
        const signString = `${UDESK_EMAIL}&${UDESK_API_TOKEN}&${timestamp}&${nonce}&${sign_version}`;
        const sign = crypto.createHash('sha1').update(signString).digest('hex');

        const udeskUrl = `https://${UDESK_DOMAIN}/open_api_v1/tickets?email=${UDESK_EMAIL}&timestamp=${timestamp}&sign=${sign}&nonce=${nonce}&sign_version=${sign_version}`;

        const udeskPayload = {
            "ticket": {
                "subject": shopifyData.subject || "Shopify 用户留言",
                "content": shopifyData.content || "内容为空",
                "type": "email",
                "type_content": shopifyData.customerEmail,
                "creator_email": shopifyData.customerEmail
            }
        };

        const response = await axios.post(udeskUrl, udeskPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // 成功返回
        return res.status(200).json({ success: true, data: response.data });

    } catch (error) {
        // 失败返回
        console.error('Udesk API 报错:', error.response?.data || error.message);
        return res.status(500).json({ success: false, error: error.response?.data || error.message });
    }
};
