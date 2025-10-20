# 🔧 Solución: Email Timeout en Railway

## Problema
El email funciona en localhost pero **falla con timeout en Railway**.

## Causa
Railway y otros proveedores cloud **bloquean el puerto 587 (SMTP)** por seguridad. 

## ✅ Solución Rápida

### 1. Actualiza las Variables de Entorno en Railway

Ve a tu proyecto en Railway → **Variables** y actualiza/añade:

```env
NODE_ENV=production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
EMAIL_USER=tu_email@gmail.com
EMAIL_PASSWORD=tu_contraseña_app_16_caracteres
EMAIL_RECIPIENTS=destinatario@example.com
```

**⚠️ IMPORTANTE:**
- Usa **puerto 465** (no 587)
- Asegúrate de usar la **contraseña de aplicación** de Gmail (16 caracteres)
- No pongas espacios en la contraseña

### 2. Redeploy en Railway

Después de cambiar las variables:
1. Ve a **Deployments**
2. Click en el último deployment
3. Click en **"Redeploy"**

### 3. Verifica los Logs

En Railway → **Deployments** → Ver logs del deployment:

Busca:
```
✅ Email transporter is ready
```

Si ves esto, la configuración es correcta.

### 4. Prueba el Endpoint

```bash
curl -X POST https://tu-app.up.railway.app/trigger-report
```

---

## 🐛 Si Sigue Fallando

### Opción A: Activar Debug

En Railway Variables, añade:
```env
EMAIL_DEBUG=true
```

Redeploy y revisa los logs para ver el error exacto.

### Opción B: Verifica la Contraseña

1. La contraseña debe ser de **aplicación** (no tu contraseña normal)
2. Debe tener **16 caracteres** (puede tener espacios que debes quitar)
3. Genera una nueva: https://myaccount.google.com/apppasswords

### Opción C: Verifica los Destinatarios

Asegúrate que `EMAIL_RECIPIENTS` tenga formato correcto:
```
# Un destinatario
EMAIL_RECIPIENTS=usuario@example.com

# Múltiples (separados por coma, sin espacios)
EMAIL_RECIPIENTS=usuario1@example.com,usuario2@example.com
```

---

## 🆘 Alternativa: Usar SendGrid (Gratis)

Si Gmail sigue sin funcionar, puedes usar SendGrid que es más confiable en Railway:

### 1. Crear cuenta en SendGrid

1. Ve a https://sendgrid.com/
2. Crea una cuenta gratis (100 emails/día gratis)
3. Ve a Settings → API Keys
4. Crea un nuevo API Key

### 2. Instalar dependencia

```bash
npm install @sendgrid/mail
```

### 3. Actualizar código

Crea un archivo `email-sendgrid.js`:

```javascript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendEmailWithSendGrid(htmlContent, subject) {
  const msg = {
    to: process.env.EMAIL_RECIPIENTS.split(','),
    from: process.env.EMAIL_FROM, // Debe ser verificado en SendGrid
    subject: subject,
    html: htmlContent,
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email sent via SendGrid');
    return { success: true };
  } catch (error) {
    console.error('❌ SendGrid error:', error);
    throw error;
  }
}
```

### 4. Variables en Railway

```env
SENDGRID_API_KEY=SG.xxx...
EMAIL_FROM=noreply@tudominio.com
EMAIL_RECIPIENTS=destinatario@example.com
```

---

## 📊 Comparación de Opciones

| Opción | Pros | Contras |
|--------|------|---------|
| **Gmail puerto 465** | ✅ Gratis, Fácil | ⚠️ Límite 500/día, Puede bloquearse |
| **SendGrid** | ✅ Confiable, 100/día gratis | ❌ Requiere verificar dominio |
| **Mailgun** | ✅ 5000/mes gratis | ❌ Requiere tarjeta |
| **AWS SES** | ✅ Muy barato, Ilimitado | ❌ Más complejo |

---

## 🎯 Checklist Railway

Antes de desplegar, verifica:

- [ ] `NODE_ENV=production` configurado
- [ ] `SMTP_PORT=465` (no 587)
- [ ] `EMAIL_PASSWORD` es contraseña de app (16 chars)
- [ ] `EMAIL_USER` y `EMAIL_RECIPIENTS` correctos
- [ ] Código commiteado y pusheado
- [ ] Redeploy realizado después de cambiar variables
- [ ] Logs revisados para confirmar "✅ Email transporter is ready"

---

## 💡 Tips Importantes

1. **Railway detecta `RAILWAY_ENVIRONMENT`** automáticamente - el código usa puerto 465 en producción
2. **Los cambios de variables requieren redeploy** - no se aplican automáticamente
3. **La contraseña de app caduca** - si deja de funcionar, genera una nueva
4. **Límites de Gmail:** Max 500 emails/día con cuenta gratis

---

## 🔍 Verificar Configuración Actual

Para ver qué configuración está usando, añade estos logs temporalmente:

```javascript
console.log('Environment:', process.env.NODE_ENV);
console.log('SMTP Port:', process.env.SMTP_PORT || (isProduction ? 465 : 587));
console.log('Email User:', process.env.EMAIL_USER);
console.log('Has Password:', !!process.env.EMAIL_PASSWORD);
```

---

## 📞 Último Recurso

Si nada funciona, considera:

1. **Cambiar a un servicio de email dedicado** (SendGrid, Mailgun)
2. **Usar un webhook** para enviar notificaciones (Discord, Slack, Telegram)
3. **Guardar reportes en archivo** y accederlos vía endpoint
