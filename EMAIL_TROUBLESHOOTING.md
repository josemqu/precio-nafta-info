# Solución de Problemas de Email

## Error: Connection Timeout

Este error ocurre cuando nodemailer no puede conectarse al servidor SMTP de Gmail.

### Causas Comunes:

1. **Contraseña incorrecta o contraseña normal en vez de contraseña de aplicación**
2. **Verificación en 2 pasos no habilitada**
3. **Firewall bloqueando el puerto SMTP**
4. **Configuración de red restrictiva**

---

## 📝 Solución: Configurar Gmail Correctamente

### Paso 1: Habilitar Verificación en 2 Pasos

1. Ve a tu [Cuenta de Google](https://myaccount.google.com/)
2. Click en **Seguridad** (panel izquierdo)
3. En la sección "Cómo inicias sesión en Google"
4. Click en **Verificación en 2 pasos**
5. Sigue las instrucciones para habilitarla

### Paso 2: Generar Contraseña de Aplicación

1. Una vez habilitada la verificación en 2 pasos
2. Ve a [App Passwords](https://myaccount.google.com/apppasswords)
3. Selecciona **Correo** como aplicación
4. Selecciona **Otro** como dispositivo
5. Escribe "Reporte Nafta" como nombre
6. Click en **Generar**
7. **Copia la contraseña de 16 caracteres** (sin espacios)

### Paso 3: Actualizar .env.local

```env
EMAIL_SERVICE=gmail
EMAIL_USER=tu_email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # La contraseña de app de 16 caracteres
EMAIL_RECIPIENTS=destinatario@example.com
```

### Paso 4: Reiniciar el servidor

```bash
# Detén el servidor (Ctrl + C)
npm start
```

Deberías ver:
```
✅ Email transporter is ready
```

---

## 🔧 Configuración Alternativa: SMTP Manual

Si Gmail no funciona, puedes usar configuración SMTP manual:

### Para Gmail:

```env
EMAIL_SERVICE=gmail
# O usa la configuración manual:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=tu_email@gmail.com
EMAIL_PASSWORD=tu_contraseña_de_app
EMAIL_RECIPIENTS=destinatario@example.com
```

### Para Outlook/Hotmail:

```env
EMAIL_SERVICE=hotmail
# O configuración manual:
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=tu_email@outlook.com
EMAIL_PASSWORD=tu_contraseña
EMAIL_RECIPIENTS=destinatario@example.com
```

---

## 🧪 Probar la Configuración

### Test 1: Verificar al iniciar el servidor

```bash
npm start
```

Busca este mensaje:
```
Verifying email configuration...
✅ Email transporter is ready
```

### Test 2: Enviar reporte de prueba

```bash
curl -X POST http://localhost:3000/trigger-report
```

Busca estos logs:
```
Sending email...
Attempt 1/3 to send email...
✅ Email sent successfully: <message-id>
   Response: 250 2.0.0 OK ...
```

---

## ⚠️ Errores Comunes y Soluciones

### Error: "Invalid login"

**Causa:** Contraseña incorrecta o no es una contraseña de aplicación

**Solución:**
- Verifica que usas contraseña de aplicación (16 caracteres)
- No uses tu contraseña normal de Gmail
- Verifica que la verificación en 2 pasos esté habilitada

### Error: "Connection timeout"

**Causa:** Firewall o red bloqueando conexión SMTP

**Solución:**
1. Verifica tu conexión a internet
2. Prueba desde otra red (ej: hotspot móvil)
3. Verifica que el puerto 587 no esté bloqueado:
   ```bash
   telnet smtp.gmail.com 587
   ```
4. Si estás detrás de un proxy corporativo, configúralo

### Error: "self signed certificate"

**Causa:** Problema con certificados SSL

**Solución:** Ya está configurado en el código con:
```javascript
tls: {
  rejectUnauthorized: false,
}
```

### Error: "Greeting never received"

**Causa:** Servidor SMTP no responde a tiempo

**Solución:** Los timeouts ya están aumentados a 60 segundos en el código.

---

## 🔍 Debug Avanzado

Si sigues teniendo problemas, activa el debug:

### Opción 1: En el código (index.js)

Cambia estas líneas:
```javascript
logger: true,   // Cambiar a true
debug: true,    // Cambiar a true
```

### Opción 2: Variable de entorno

```bash
DEBUG=nodemailer* npm start
```

Esto mostrará toda la comunicación SMTP en la consola.

---

## 📊 Checklist de Troubleshooting

- [ ] Verificación en 2 pasos habilitada en Google
- [ ] Contraseña de aplicación generada (16 caracteres)
- [ ] `.env.local` actualizado con credenciales correctas
- [ ] Servidor reiniciado después de cambiar `.env.local`
- [ ] Mensaje "✅ Email transporter is ready" aparece al iniciar
- [ ] Puerto 587 no está bloqueado por firewall
- [ ] EMAIL_USER y EMAIL_RECIPIENTS tienen formato correcto
- [ ] Internet funciona correctamente

---

## 💡 Mejoras Implementadas

El código ya incluye estas mejoras:

✅ **Timeouts aumentados:** 60 segundos para conexión y socket
✅ **Pool de conexiones:** Reutiliza conexiones para mejor rendimiento
✅ **Retry logic:** 3 intentos automáticos con espera incremental
✅ **Mejor logging:** Muestra detalles de cada intento
✅ **Verificación temprana:** Verifica conexión al iniciar el servidor
✅ **Configuración TLS robusta:** Maneja certificados problemáticos

---

## 🆘 Soporte Adicional

Si nada funciona:

1. **Revisa los logs completos** del servidor
2. **Prueba con otro email** como destinatario
3. **Verifica que Gmail permita "apps menos seguras"** (aunque con contraseña de app no debería ser necesario)
4. **Contacta a tu proveedor de internet** si hay restricciones de puerto

## 🌐 Alternativas a Gmail

Si Gmail no funciona por políticas corporativas, considera:

- **SendGrid** (gratis hasta 100 emails/día)
- **Mailgun** (gratis hasta 5000 emails/mes)
- **AWS SES** (muy económico)
- **Outlook/Hotmail** (similar a Gmail)
