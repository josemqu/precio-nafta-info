# Guía de Despliegue en Railway

## 🚀 Despliegue Inicial

### 1. Preparar el Repositorio
Asegúrate de que todos los cambios estén commiteados:
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

### 2. Crear Proyecto en Railway

1. Ve a [Railway.app](https://railway.app/) e inicia sesión
2. Haz clic en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Selecciona el repositorio `precio-nafta-info`
5. Railway detectará automáticamente que es una aplicación Node.js

### 3. Configurar Variables de Entorno

En el dashboard de Railway, ve a la pestaña **"Variables"** y añade:

```
NODE_ENV=production
PORT=3000
API_ENDPOINT=https://datos.energia.gob.ar/api/3/action/datastore_search?resource_id=e37c1059-e8e4-4641-81e5-e098e80781fb&limit=100000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
EMAIL_USER=tu_email@gmail.com
EMAIL_PASSWORD=tu_app_password_aqui
EMAIL_RECIPIENTS=destinatario1@example.com,destinatario2@example.com
```

**⚠️ IMPORTANTE sobre Email:**
- **Usa puerto 465** (no 587) - Railway bloquea el puerto 587
- **EMAIL_PASSWORD** debe ser una contraseña de aplicación de Gmail (16 caracteres)
- Genera una en: https://myaccount.google.com/apppasswords
- Si el email falla con timeout, consulta: [RAILWAY_EMAIL_FIX.md](RAILWAY_EMAIL_FIX.md)

### 4. Desplegar

Railway desplegará automáticamente tu aplicación. El proceso incluye:
- ✅ Instalar dependencias (`npm install`)
- ✅ Ejecutar el comando de inicio (`npm start`)
- ✅ Asignar un dominio público

### 5. Obtener la URL de tu Aplicación

1. En el dashboard de Railway, ve a **"Settings"** → **"Domains"**
2. Haz clic en **"Generate Domain"** para obtener un subdominio `.up.railway.app`
3. Copia esta URL (ej: `https://tu-app.up.railway.app`)

### 6. Configurar GitHub Actions (Opcional)

Si quieres usar GitHub Actions para disparar reportes automáticos:

1. Ve a tu repositorio en GitHub
2. Settings → Secrets and variables → Actions
3. Añade un nuevo secret:
   - **Name:** `APP_URL`
   - **Value:** `https://tu-app.up.railway.app` (tu URL de Railway)

## 🧪 Probar el Despliegue

Una vez desplegado, prueba los endpoints:

### Health Check
```bash
curl https://tu-app.up.railway.app/health
```

### Disparar Reporte Manual
```bash
curl -X POST https://tu-app.up.railway.app/trigger-report
```

## 📊 Monitoreo

Railway proporciona:
- **Logs en tiempo real:** Pestaña "Deployments" → Ver logs
- **Métricas:** CPU, memoria, y uso de red
- **Deploy automático:** Cada push a `main` despliega automáticamente

## 🔧 Redeploy Manual

Si necesitas redesplegar manualmente:

1. Ve a tu proyecto en Railway
2. Pestaña "Deployments"
3. Haz clic en **"Redeploy"** en el último deployment

## 🌐 Dominio Personalizado (Opcional)

Para usar tu propio dominio:

1. Ve a **"Settings"** → **"Domains"**
2. Haz clic en **"Custom Domain"**
3. Añade tu dominio y configura los registros DNS según las instrucciones

## 🔒 Seguridad

- ✅ `.env` y `.env.local` están en `.gitignore` (no se suben al repo)
- ✅ Variables sensibles están en Railway, no en el código
- ✅ Usa contraseñas de aplicación de Gmail, no tu contraseña personal

## 📝 Comandos Útiles

### Ver logs en tiempo real
En el dashboard de Railway, pestaña "Deployments" → Click en el deployment actual

### Reiniciar el servicio
Pestaña "Settings" → Scroll down → "Restart Service"

## 🐛 Troubleshooting

### El deployment falla
- Verifica que todas las variables de entorno estén configuradas
- Revisa los logs en Railway para ver el error específico

### La app no responde
- Verifica que el servicio esté corriendo en Railway
- Comprueba los logs para errores de runtime

### Email no se envía
- Verifica `EMAIL_USER` y `EMAIL_PASSWORD` en las variables de Railway
- Asegúrate de usar una contraseña de aplicación de Gmail

## 📋 Checklist de Despliegue

- [ ] Código commiteado y pusheado a GitHub
- [ ] Proyecto creado en Railway
- [ ] Variables de entorno configuradas
- [ ] Deployment completado exitosamente
- [ ] Health check funciona (`/health`)
- [ ] Trigger report funciona (`/trigger-report`)
- [ ] URL añadida como secret en GitHub Actions
- [ ] GitHub Actions workflow funciona correctamente

## 💡 Tips

1. **Logs:** Railway mantiene logs de las últimas 24 horas
2. **Auto-deploy:** Por defecto, cada push a `main` despliega automáticamente
3. **Rollback:** Puedes volver a un deployment anterior desde la pestaña "Deployments"
4. **Variables:** Cambiar variables de entorno requiere un redeploy

## 📞 Soporte

- [Documentación de Railway](https://docs.railway.app/)
- [Community Forum](https://help.railway.app/)
