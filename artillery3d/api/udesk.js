const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

export default async function handler(req, res) {
    // 1. 设置 CORS (允许 Shopify 前端调用，如果是 Webhook 触发则可省略)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // 如果为了安全，这里可以换成你的 Shopify 域名
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // 处理 OPTIONS 请求 (CORS 预检)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只允许 POST 请求' });
    }

    try {
        // 2. 获取从 Shopify 传过来的数据 (表单提交的数据 或 Webhook 数据)
        const shopifyData = req.body; 

        // 3. 读取 Vercel 环境变量里的 Udesk 密钥信息
        const UDESK_EMAIL = process.env.UDESK_EMAIL;
        const UDESK_API_TOKEN = process.env.UDESK_API_TOKEN;
        const UDESK_DOMAIN = process.env.UDESK_DOMAIN; // 例如 demo.udesk.cn

        // 4. 生成 Udesk 要求的动态签名 (签名算法请严格参考 Udesk 最新官方文档)
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = uuidv4();
        const sign_version = 'v2';
        
        // 假设 Udesk 的 v2 签名规则是组合这几个字段后进行 SHA1 加密
        const signString = `${UDESK_EMAIL}&${UDESK_API_TOKEN}&${timestamp}&${nonce}&${sign_version}`;
        const sign = crypto.createHash('sha1').update(signString).digest('hex');

        // 5. 拼接 Udesk API URL
        const udeskUrl = `https://${UDESK_DOMAIN}/open_api_v1/tickets?email=${UDESK_EMAIL}&timestamp=${timestamp}&sign=${sign}&nonce=${nonce}&sign_version=${sign_version}`;

        // 6. 构造发送给 Udesk 的真实工单数据 (把你原本的 curl 里的 JSON 搬过来并替换变量)
        const udeskPayload = {
            "ticket": {
                "subject": shopifyData.subject || "Shopify 默认工单",
                "content": shopifyData.content || "工单内容为空",
                "type": "customer_id",
                "priority": "标准",
                "status_id": 1,
                "agent_group_name": "默认组",
                "ticket_field": {
                    "TextField_1": shopifyData.customerEmail || "",
                    // 其他你想映射的字段...
                }
            }
        };

        // 7. 发送请求给 Udesk
        const response = await axios.post(udeskUrl, udeskPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // 8. 成功后返回给 Shopify
        return res.status(200).json({ 
            success: true, 
            message: 'Udesk 工单创建成功',
            data: response.data 
        });

    } catch (error) {
        console.error('Udesk API Error:', error.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            error: '工单创建失败', 
            details: error.response?.data || error.message 
        });
    }
}
