# API Report Mailer

Una aplicación Node.js que obtiene datos de una API, los filtra por fecha, genera un reporte y lo envía por email. Incluye un endpoint para disparar el workflow manualmente o desde GitHub Actions.

## Características

- 🔄 Obtiene datos de cualquier API REST
- 📅 Filtra datos por rango de fechas
- 📊 Genera reportes automáticos
- 📧 Envía reportes por email
- 🚀 Endpoint para GitHub Actions
- ⚡ Configuración flexible con variables de entorno

## Instalación

1. **Clonar e instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env
```

Edita el archivo `.env` con tus configuraciones:

```env
# Configuración del servidor
PORT=3000

# Configuración de la API
API_ENDPOINT=https://tu-api.com/endpoint
API_KEY=tu_api_key_aqui

# Configuración de email
EMAIL_SERVICE=gmail
EMAIL_USER=tu_email@gmail.com
EMAIL_PASSWORD=tu_app_password
EMAIL_RECIPIENTS=destinatario1@example.com,destinatario2@example.com
```

## Uso

### Ejecutar la aplicación

```bash
# Producción
npm start

# Desarrollo (con nodemon)
npm run dev
```

### Endpoints disponibles

#### 1. Health Check
```http
GET /health
```

#### 2. Disparar reporte (POST)
```http
POST /trigger-report
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

#### 3. Disparar reporte (GET) - Para GitHub Actions
```http
GET /trigger-report?startDate=2024-01-01&endDate=2024-01-31
```

Si no se proporcionan fechas, usa los últimos 7 días por defecto.

## Configuración de Email

### Gmail
1. Habilita la verificación en 2 pasos
2. Genera una contraseña de aplicación
3. Usa la contraseña de aplicación en `EMAIL_PASSWORD`

### Otros proveedores
Cambia `EMAIL_SERVICE` por uno de estos valores:
- `gmail`
- `outlook`
- `yahoo`
- `hotmail`

## GitHub Actions

Crea un archivo `.github/workflows/daily-report.yml`:

```yaml
name: Daily Report

on:
  schedule:
    - cron: '0 9 * * *'  # Diario a las 9 AM UTC
  workflow_dispatch:     # Permite ejecución manual

jobs:
  send-report:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Report
        run: |
          curl -X GET "https://tu-app.com/trigger-report"
```

## Personalización

### Filtrado de datos
La aplicación busca campos de fecha en este orden:
1. `date`
2. `created_at`
3. `timestamp`

Para usar un campo personalizado, modifica la función `filterDataByDate` en `index.js`.

### Formato del reporte
Modifica la función `generateReport` para personalizar el formato del reporte.

## Estructura del proyecto

```
├── index.js          # Aplicación principal
├── package.json      # Dependencias y scripts
├── .env.example      # Ejemplo de configuración
└── README.md         # Documentación
```

## Troubleshooting

### Error de autenticación de email
- Verifica que uses una contraseña de aplicación, no tu contraseña normal
- Asegúrate de que la verificación en 2 pasos esté habilitada

### Error de API
- Verifica que `API_ENDPOINT` sea correcto
- Comprueba si necesitas `API_KEY` para tu endpoint

### Fechas inválidas
- Usa formato `YYYY-MM-DD`
- La fecha de inicio debe ser anterior a la fecha final

## Logs

La aplicación registra información detallada en la consola:
- Inicio del workflow
- Obtención de datos de la API
- Filtrado por fechas
- Generación del reporte
- Envío del email

## Licencia

MIT
