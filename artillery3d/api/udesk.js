const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

export default async function handler(req, res) {
    // 1. 设置允许 Shopify 前端跨域访问 (CORS)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // 预检请求直接返回 200
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 只允许 POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只允许 POST 请求' });
    }

    try {
        // 获取 Shopify 前端传过来的数据
        const shopifyData = req.body; 

        // 读取 Vercel 环境变量里的密钥
        const UDESK_EMAIL = process.env.UDESK_EMAIL;
        const UDESK_API_TOKEN = process.env.UDESK_API_TOKEN;
        const UDESK_DOMAIN = process.env.UDESK_DOMAIN;

        // 生成 Udesk 要求的动态签名 (v2)
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = uuidv4();
        const sign_version = 'v2';
        
        const signString = `${UDESK_EMAIL}&${UDESK_API_TOKEN}&${timestamp}&${nonce}&${sign_version}`;
        const sign = crypto.createHash('sha1').update(signString).digest('hex');

        // 拼接完整的 Udesk API 请求链接
        const udeskUrl = `https://${UDESK_DOMAIN}/open_api_v1/tickets?email=${UDESK_EMAIL}&timestamp=${timestamp}&sign=${sign}&nonce=${nonce}&sign_version=${sign_version}`;

        // 🎯 核心修复区：只传必填参数和邮箱对应关系
        const udeskPayload = {
            "ticket": {
                // 必填项：标题和内容
                "subject": shopifyData.subject || "Shopify 用户留言",
                "content": shopifyData.content || "内容为空",
                
                // 选填项：根据官方文档，使用邮箱匹配客户身份
                "type": "email",
                "type_content": shopifyData.customerEmail,
                
                // 直接将该邮箱指定为工单创建人
                "creator_email": shopifyData.customerEmail
            }
        };

        // 发送请求给 Udesk
        const response = await axios.post(udeskUrl, udeskPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // 成功后返回
        return res.status(200).json({ 
            success: true, 
            data: response.data 
        });

    } catch (error) {
        // 如果失败，打印详细的 Udesk 报错信息到 Vercel 日志
        console.error('Udesk API 报错了:', error.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            error: error.response?.data || error.message 
        });
    }
}
