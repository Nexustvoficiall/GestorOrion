/**
 * services/emailService.js
 * Serviço de envio de e-mail via SMTP (nodemailer)
 *
 * Variáveis de ambiente necessárias:
 *   SMTP_HOST   ex: smtp.gmail.com
 *   SMTP_PORT   ex: 587
 *   SMTP_USER   ex: orion@seudominio.com
 *   SMTP_PASS   ex: senha_ou_app_password
 *   SMTP_FROM   ex: "Gestor Orion <orion@seudominio.com>"
 *   APP_URL     ex: https://gestororion.up.railway.app
 */
const nodemailer = require('nodemailer');

function createTransporter() {
    // Se não houver SMTP configurado, retorna null (email desabilitado)
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return null;
    }
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: parseInt(process.env.SMTP_PORT || '587') === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: { rejectUnauthorized: false }
    });
}

const BASE_URL = () => process.env.APP_URL || 'http://localhost:3000';
const FROM     = () => process.env.SMTP_FROM || `"Gestor Orion" <${process.env.SMTP_USER}>`;

const STYLE = `
  body { background:#0a0a12; color:#ccc; font-family:'Segoe UI',sans-serif; margin:0; padding:0; }
  .wrap { max-width:520px; margin:40px auto; background:#12121e; border:1px solid #2a2a3c; border-radius:12px; overflow:hidden; }
  .head { background:#1a1a2e; padding:28px 32px; border-bottom:3px solid #1a6fff; }
  .head h1 { margin:0; font-size:20px; color:#fff; letter-spacing:2px; }
  .head p  { margin:4px 0 0; font-size:11px; color:#888; letter-spacing:1px; }
  .body { padding:28px 32px; }
  .body p  { font-size:14px; line-height:1.7; color:#ccc; margin:0 0 16px; }
  .btn { display:inline-block; background:#1a6fff; color:#fff; text-decoration:none; padding:12px 28px; border-radius:6px; font-size:14px; font-weight:bold; letter-spacing:1px; }
  .box { background:#1e1e30; border:1px solid #333; border-radius:6px; padding:14px 18px; margin:16px 0; font-family:monospace; font-size:15px; color:#ffeb3b; word-break:break-all; }
  .foot { padding:16px 32px; background:#0f0f1a; font-size:11px; color:#555; text-align:center; }
`;

/**
 * Enviar e-mail de boas-vindas ao novo tenant admin
 */
async function sendWelcome(to, username, tenantName) {
    const transporter = createTransporter();
    if (!transporter) return;
    try {
        await transporter.sendMail({
            from: FROM(),
            to,
            subject: `🚀 Bem-vindo ao Gestor Orion — ${tenantName}`,
            html: `<html><head><style>${STYLE}</style></head><body>
              <div class="wrap">
                <div class="head"><h1>GESTOR ORION</h1><p>PLATAFORMA DE GESTÃO IPTV</p></div>
                <div class="body">
                  <p>Olá, <b>${username}</b>!</p>
                  <p>Sua conta <b>${tenantName}</b> foi criada com sucesso. Você está com <b>7 dias de teste gratuito</b>.</p>
                  <p><a href="${BASE_URL()}/login" class="btn">ACESSAR PAINEL</a></p>
                  <p style="font-size:12px;color:#666">Se tiver dúvidas, fale com o suporte.</p>
                </div>
                <div class="foot">Gestor Orion &mdash; ${new Date().getFullYear()}</div>
              </div>
            </body></html>`
        });
    } catch (err) {
        console.error('[emailService] sendWelcome error:', err.message);
    }
}

/**
 * Enviar link de redefinição de senha
 */
async function sendPasswordReset(to, username, token) {
    const transporter = createTransporter();
    if (!transporter) return;
    const link = `${BASE_URL()}/reset-password?token=${token}`;
    try {
        await transporter.sendMail({
            from: FROM(),
            to,
            subject: '🔑 Redefinição de Senha — Gestor Orion',
            html: `<html><head><style>${STYLE}</style></head><body>
              <div class="wrap">
                <div class="head"><h1>GESTOR ORION</h1><p>REDEFINIÇÃO DE SENHA</p></div>
                <div class="body">
                  <p>Olá, <b>${username}</b>!</p>
                  <p>Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo:</p>
                  <p><a href="${link}" class="btn">REDEFINIR MINHA SENHA</a></p>
                  <p>Ou copie e cole o link abaixo no seu navegador:</p>
                  <div class="box">${link}</div>
                  <p style="font-size:12px;color:#666">Este link é válido por <b>24 horas</b>. Se não solicitou a redefinição, ignore este e-mail.</p>
                </div>
                <div class="foot">Gestor Orion &mdash; ${new Date().getFullYear()}</div>
              </div>
            </body></html>`
        });
    } catch (err) {
        console.error('[emailService] sendPasswordReset error:', err.message);
    }
}

/**
 * Aviso de vencimento próximo (painel expirando em X dias)
 */
async function sendExpiryWarning(to, username, daysLeft) {
    const transporter = createTransporter();
    if (!transporter) return;
    try {
        await transporter.sendMail({
            from: FROM(),
            to,
            subject: `⚠️ Seu acesso vence em ${daysLeft} dia(s) — Gestor Orion`,
            html: `<html><head><style>${STYLE}</style></head><body>
              <div class="wrap">
                <div class="head"><h1>GESTOR ORION</h1><p>AVISO DE VENCIMENTO</p></div>
                <div class="body">
                  <p>Olá, <b>${username}</b>!</p>
                  <p>Seu acesso ao painel <b>vence em ${daysLeft} dia(s)</b>. Renove agora para não perder o acesso.</p>
                  <p><a href="${BASE_URL()}/login" class="btn">RENOVAR AGORA</a></p>
                </div>
                <div class="foot">Gestor Orion &mdash; ${new Date().getFullYear()}</div>
              </div>
            </body></html>`
        });
    } catch (err) {
        console.error('[emailService] sendExpiryWarning error:', err.message);
    }
}

/**
 * Enviar credenciais de acesso do novo usuário
 */
async function sendUserCredentials(to, username, password, panelUrl) {
    const transporter = createTransporter();
    if (!transporter) return;
    try {
        await transporter.sendMail({
            from: FROM(),
            to,
            subject: '🔐 Suas credenciais de acesso — Gestor Orion',
            html: `<html><head><style>${STYLE}</style></head><body>
              <div class="wrap">
                <div class="head"><h1>GESTOR ORION</h1><p>CREDENCIAIS DE ACESSO</p></div>
                <div class="body">
                  <p>Olá, <b>${username}</b>!</p>
                  <p>Sua conta foi criada. Suas credenciais de acesso:</p>
                  <div class="box">Usuário: ${username}<br>Senha: ${password}</div>
                  <p><a href="${panelUrl || BASE_URL() + '/login'}" class="btn">ACESSAR PAINEL</a></p>
                  <p style="font-size:12px;color:#666">Recomendamos que altere sua senha após o primeiro acesso.</p>
                </div>
                <div class="foot">Gestor Orion &mdash; ${new Date().getFullYear()}</div>
              </div>
            </body></html>`
        });
    } catch (err) {
        console.error('[emailService] sendUserCredentials error:', err.message);
    }
}

module.exports = {
    sendWelcome,
    sendPasswordReset,
    sendExpiryWarning,
    sendUserCredentials
};
