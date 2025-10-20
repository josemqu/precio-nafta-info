import express from "express";
import axios from "axios";
import nodemailer from "nodemailer";
import moment from "moment";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Email transporter configuration
// Railway y otros proveedores cloud a menudo bloquean puerto 587 (SMTP)
// Usamos puerto 465 (SSL) que es más confiable en producción
const isProduction = process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT;

const emailConfig = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || (isProduction ? 465 : 587)),
  secure: isProduction ? true : false, // true para puerto 465 (SSL), false para 587 (TLS)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  // Configuración adicional para evitar timeouts
  pool: true, // Usar pool de conexiones
  maxConnections: 3,
  maxMessages: 10,
  rateDelta: 1000,
  rateLimit: 5,
  // Timeouts aumentados para producción
  connectionTimeout: 90000, // 90 segundos
  greetingTimeout: 45000, // 45 segundos
  socketTimeout: 90000, // 90 segundos
  // Logging para debug (activar en caso de problemas)
  logger: process.env.EMAIL_DEBUG === "true",
  debug: process.env.EMAIL_DEBUG === "true",
  // Opciones de seguridad
  tls: {
    rejectUnauthorized: false,
    minVersion: "TLSv1.2",
  },
};

// Log de configuración para debug
console.log("\n📧 Email Configuration:");
console.log("  Environment:", isProduction ? "production" : "development");
console.log("  Host:", emailConfig.host);
console.log("  Port:", emailConfig.port);
console.log("  Secure (SSL):", emailConfig.secure);
console.log("  User:", emailConfig.auth.user ? emailConfig.auth.user : "❌ NOT SET");
console.log("  Password:", emailConfig.auth.pass ? "✓ Set (" + emailConfig.auth.pass.length + " chars)" : "❌ NOT SET");

const transporter = nodemailer.createTransport(emailConfig);

// Verify transporter configuration
async function verifyEmailConnection() {
  try {
    await transporter.verify();
    console.log("✅ Email transporter is ready");
    return true;
  } catch (error) {
    console.error("❌ Email transporter verification failed:", error.message);
    console.error("Check your EMAIL_USER and EMAIL_PASSWORD in .env.local");
    return false;
  }
}

// Function to fetch data from API
async function fetchApiData() {
  try {
    const response = await axios.get(process.env.API_ENDPOINT, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching API data:", error.message);
    throw new Error(`Failed to fetch API data: ${error.message}`);
  }
}

// Function to filter data for today only
function filterTodayData(data) {
  if (!data || !data.result || !Array.isArray(data.result.records)) {
    console.warn("Data structure not as expected, returning empty array");
    return [];
  }

  // Get today's date in Argentina timezone (UTC-3)
  const todayArgentina = moment().utcOffset(-3).format("YYYY-MM-DD");

  return data.result.records.filter((item) => {
    // fecha_vigencia is in Argentina local time, so we compare directly
    const itemDate = moment(item.fecha_vigencia).format("YYYY-MM-DD");
    return itemDate === todayArgentina;
  });
}

// Function to group data by field
function groupDataBy(data, field) {
  const grouped = {};
  data.forEach((item) => {
    const key = item[field] || "Sin especificar";
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  });
  return grouped;
}

// Function to analyze data and create statistics
function analyzeData(todayData, allData) {
  const analysis = {
    totalRecords: todayData.length,
    byProduct: {},
    byProvince: {},
    byGasStation: {},
    byFlagCompany: {},
    byLocality: {},
    gasStationStats: {
      totalStations: 0,
      activeStationsToday: 0,
      activeStationsWithPrices: 0,
      percentageActive: 0,
      percentageWithPrices: 0,
    },
    flagCompanyStats: {
      totalBrands: 0,
      activeBrandsToday: 0,
      activeBrandsWithPrices: 0,
      percentageActive: 0,
    },
  };

  // Group by product
  const productGroups = groupDataBy(todayData, "producto");
  analysis.byProduct = Object.keys(productGroups)
    .map((product) => {
      const records = productGroups[product];
      // Count unique stations that updated this specific product
      const uniqueStationsForProduct = new Set(
        records.map((item) => item.idempresa).filter(Boolean)
      ).size;

      return {
        name: product,
        count: records.length,
        activeStations: uniqueStationsForProduct,
        records: records,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Group by province
  const provinceGroups = groupDataBy(todayData, "provincia");
  analysis.byProvince = Object.keys(provinceGroups)
    .map((province) => {
      const records = provinceGroups[province];
      const activeStations = new Set(
        records.map((item) => item.idempresa).filter(Boolean)
      ).size;
      return {
        name: province,
        count: records.length,
        activeStations: activeStations,
        records: records,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Group by gas station (empresa)
  const gasStationGroups = groupDataBy(todayData, "empresa");
  analysis.byGasStation = Object.keys(gasStationGroups)
    .map((station) => ({
      name: station,
      count: gasStationGroups[station].length,
      records: gasStationGroups[station],
    }))
    .sort((a, b) => b.count - a.count);

  // Group by flag company (marca)
  const flagCompanyGroups = groupDataBy(todayData, "empresabandera");
  analysis.byFlagCompany = Object.keys(flagCompanyGroups)
    .map((company) => {
      const records = flagCompanyGroups[company];
      const activeStations = new Set(
        records.map((item) => item.idempresa).filter(Boolean)
      ).size;
      return {
        name: company,
        count: records.length,
        activeStations: activeStations,
        records: records,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Group by locality (localidad)
  const localityGroups = groupDataBy(todayData, "localidad");
  analysis.byLocality = Object.keys(localityGroups)
    .map((locality) => {
      const records = localityGroups[locality];
      const activeStations = new Set(
        records.map((item) => item.idempresa).filter(Boolean)
      ).size;
      return {
        name: locality,
        count: records.length,
        activeStations: activeStations,
        records: records,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 only

  // Calculate gas station statistics (Empresa = Estación de Servicio)
  const totalUniqueStations = new Set(
    allData.map((item) => item.idempresa).filter(Boolean)
  );
  const activeStationsToday = new Set(
    todayData.map((item) => item.idempresa).filter(Boolean)
  );
  const activeStationsWithPrices = new Set(
    todayData
      .filter((item) => item.precio && item.precio > 0)
      .map((item) => item.idempresa)
  );

  analysis.gasStationStats = {
    totalStations: totalUniqueStations.size,
    activeStationsToday: activeStationsToday.size,
    activeStationsWithPrices: activeStationsWithPrices.size,
    percentageActive:
      totalUniqueStations.size > 0
        ? ((activeStationsToday.size / totalUniqueStations.size) * 100).toFixed(
            2
          )
        : 0,
    percentageWithPrices:
      activeStationsToday.size > 0
        ? (
            (activeStationsWithPrices.size / activeStationsToday.size) *
            100
          ).toFixed(2)
        : 0,
  };

  // Calculate flag company statistics (Empresa Bandera = Marca)
  const activeBrandsToday = new Set(
    todayData.map((item) => item.empresabandera).filter(Boolean)
  );
  const activeBrandsWithPrices = new Set(
    todayData
      .filter((item) => item.precio && item.precio > 0)
      .map((item) => item.empresabandera)
  );

  analysis.flagCompanyStats = {
    totalBrands: activeBrandsToday.size,
    activeBrandsToday: activeBrandsToday.size,
    activeBrandsWithPrices: activeBrandsWithPrices.size,
    percentageActive:
      activeBrandsToday.size > 0
        ? (
            (activeBrandsWithPrices.size / activeBrandsToday.size) *
            100
          ).toFixed(2)
        : 0,
  };

  return analysis;
}

// Function to generate professional HTML report
function generateReport(apiData) {
  const reportDate = moment().format("DD/MM/YYYY HH:mm:ss");
  const today = moment().format("DD/MM/YYYY");

  // Get today's data for analysis
  const todayData = filterTodayData(apiData);
  const allData = apiData.result ? apiData.result.records : [];
  const analysis = analyzeData(todayData, allData);

  const htmlReport = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Precios de Combustibles - ${today}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .content {
            padding: 30px;
        }
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 40px;
        }
        .card {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .card-content {
            flex: 1;
            margin-bottom: 10px;
        }
        .card h3 {
            margin: 0 0 5px 0;
            color: #667eea;
            font-size: 1em;
            font-weight: 600;
        }
        .card p {
            margin: 0;
            font-size: 0.85em;
            color: #666;
            line-height: 1.3;
        }
        .card .number {
            font-size: 2em;
            font-weight: bold;
            color: #333;
            margin-left: 15px;
            min-width: 60px;
            text-align: right;
        }
        @media (max-width: 768px) {
            .summary-cards {
                grid-template-columns: 1fr;
            }
            .card {
                flex-direction: column;
                text-align: center;
            }
            .card .number {
                margin-left: 0;
                margin-top: 10px;
            }
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        th {
            background: #667eea;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
        }
        tr:hover {
            background-color: #f8f9fa;
        }
        .percentage {
            font-weight: bold;
            color: #28a745;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            border-top: 1px solid #eee;
        }
        .no-data {
            text-align: center;
            color: #666;
            font-style: italic;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Reporte de Precios de Combustibles</h1>
            <p>Datos del día ${today} | Generado el ${reportDate}</p>
        </div>
        
        <div class="content">
            <div class="summary-cards" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                <div class="card">
                    <div class="card-content">
                        <h3>Registros Nuevos Hoy</h3>
                        <p>Actualizaciones de precios del día</p>
                    </div>
                    <div class="number">${analysis.totalRecords}</div>
                </div>
                <div class="card">
                    <div class="card-content">
                        <h3>Estaciones Activas</h3>
                        <p>de ${
                          analysis.gasStationStats.totalStations
                        } estaciones totales</p>
                    </div>
                    <div class="number">${
                      analysis.gasStationStats.activeStationsToday
                    }</div>
                </div>
                <div class="card">
                    <div class="card-content">
                        <h3>Marcas Activas</h3>
                        <p>Marcas que reportaron hoy</p>
                    </div>
                    <div class="number">${
                      analysis.flagCompanyStats.activeBrandsToday
                    }</div>
                </div>
                <div class="card">
                    <div class="card-content">
                        <h3>Cobertura de Red</h3>
                        <p>Estaciones activas del total</p>
                    </div>
                    <div class="number">${
                      analysis.gasStationStats.percentageActive
                    }%</div>
                </div>
            </div>

            ${
              analysis.totalRecords > 0
                ? `
            <div class="section">
                <h2>📈 Nuevos Registros por Producto (Hoy)</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Precios Nuevos</th>
                            <th>Estaciones Activas</th>
                            <th>Porcentaje del Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysis.byProduct
                          .map(
                            (product) => `
                        <tr>
                            <td>${product.name}</td>
                            <td>${product.count}</td>
                            <td>${product.activeStations}</td>
                            <td class="percentage">${(
                              (product.count / analysis.totalRecords) *
                              100
                            ).toFixed(1)}%</td>
                        </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>

            <div class="section">
                <h2>🗺️ Nuevos Registros por Provincia (Hoy)</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Provincia</th>
                            <th>Precios Nuevos</th>
                            <th>Estaciones Activas</th>
                            <th>Porcentaje del Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysis.byProvince
                          .sort((a, b) => b.count - a.count)
                          .map(
                            (province) => `
                        <tr>
                            <td>${province.name}</td>
                            <td>${province.count}</td>
                            <td>${province.activeStations}</td>
                            <td class="percentage">${(
                              (province.count / analysis.totalRecords) *
                              100
                            ).toFixed(1)}%</td>
                        </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>


            <div class="section">
                <h2>🏢 Nuevos Registros por Marca (Hoy)</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Marca (Empresa Bandera)</th>
                            <th>Precios Nuevos</th>
                            <th>Estaciones Activas</th>
                            <th>Porcentaje del Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysis.byFlagCompany
                          .sort((a, b) => b.count - a.count)
                          .map(
                            (company) => `
                        <tr>
                            <td>${company.name}</td>
                            <td>${company.count}</td>
                            <td>${company.activeStations}</td>
                            <td class="percentage">${(
                              (company.count / analysis.totalRecords) *
                              100
                            ).toFixed(1)}%</td>
                        </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>

            <div class="section">
                <h2>🏘️ Top 10 Localidades con Más Actualizaciones</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Localidad</th>
                            <th>Precios Nuevos</th>
                            <th>Estaciones Activas</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysis.byLocality
                          .map(
                            (locality) => `
                        <tr>
                            <td>${locality.name}</td>
                            <td>${locality.count}</td>
                            <td>${locality.activeStations}</td>
                        </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>

            <div class="section">
                <h2>Estadísticas de Red de Estaciones</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Métrica</th>
                            <th>Valor</th>
                            <th>Descripción</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Total de Estaciones Registradas</td>
                            <td><strong>${
                              analysis.gasStationStats.totalStations
                            }</strong></td>
                            <td>Estaciones de servicio únicas en todo el sistema</td>
                        </tr>
                        <tr>
                            <td>Estaciones Activas Hoy</td>
                            <td><strong>${
                              analysis.gasStationStats.activeStationsToday
                            }</strong></td>
                            <td>Estaciones que reportaron precios en el día</td>
                        </tr>
                        <tr>
                            <td>Estaciones con Precios Válidos</td>
                            <td><strong>${
                              analysis.gasStationStats.activeStationsWithPrices
                            }</strong></td>
                            <td>Estaciones con precios informados (> 0)</td>
                        </tr>
                        <tr>
                            <td>Cobertura de Red</td>
                            <td><strong class="percentage">${
                              analysis.gasStationStats.percentageActive
                            }%</strong></td>
                            <td>Porcentaje de estaciones activas del total registrado</td>
                        </tr>
                        <tr>
                            <td>Calidad de Información</td>
                            <td><strong class="percentage">${
                              analysis.gasStationStats.percentageWithPrices
                            }%</strong></td>
                            <td>Porcentaje de estaciones activas con precios válidos</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="section">
                <h2>🏷️ Estadísticas de Marcas</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Métrica</th>
                            <th>Valor</th>
                            <th>Descripción</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Marcas Activas Hoy</td>
                            <td><strong>${
                              analysis.flagCompanyStats.activeBrandsToday
                            }</strong></td>
                            <td>Marcas que reportaron precios en el día</td>
                        </tr>
                        <tr>
                            <td>Marcas con Precios Válidos</td>
                            <td><strong>${
                              analysis.flagCompanyStats.activeBrandsWithPrices
                            }</strong></td>
                            <td>Marcas con precios informados (> 0)</td>
                        </tr>
                        <tr>
                            <td>Calidad de Información por Marca</td>
                            <td><strong class="percentage">${
                              analysis.flagCompanyStats.percentageActive
                            }%</strong></td>
                            <td>Porcentaje de marcas activas con precios válidos</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            `
                : `
            <div class="no-data">
                <h3>No hay datos disponibles para el día de hoy</h3>
                <p>No se encontraron registros nuevos para la fecha ${today}</p>
            </div>
            `
            }
        </div>
        
        <div class="footer">
            <p>Reporte generado automáticamente desde la API de datos.energia.gob.ar</p>
            <p>Sistema de Monitoreo de Precios de Combustibles - Argentina</p>
        </div>
    </div>
</body>
</html>`;

  return htmlReport;
}

// Function to send email with retry logic
async function sendEmail(reportContent, retries = 3) {
  const today = moment().format("DD/MM/YYYY");
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_RECIPIENTS,
    subject: `🔴 Reporte Precios Combustibles - ${today}`,
    text: `Reporte de precios de combustibles del ${today}. Ver archivo adjunto HTML para el reporte completo.`,
    html: reportContent,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${retries} to send email...`);
      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Email sent successfully:", info.messageId);
      console.log("   Response:", info.response);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (error.code) {
        console.error("   Error code:", error.code);
      }
      if (error.command) {
        console.error("   Failed command:", error.command);
      }
      
      if (attempt < retries) {
        const waitTime = attempt * 2000; // Espera incremental: 2s, 4s, 6s
        console.log(`   Waiting ${waitTime / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error("   All retry attempts exhausted");
        throw new Error(`Failed to send email after ${retries} attempts: ${error.message}`);
      }
    }
  }
}

// Main workflow function
async function executeReportWorkflow() {
  try {
    console.log("Starting report workflow...");

    // Step 1: Fetch data from API
    console.log("Fetching data from API...");
    const apiData = await fetchApiData();

    // Step 2: Get today's data
    console.log("Filtering today's data...");
    const todayData = filterTodayData(apiData);

    // Step 3: Generate report
    console.log("Generating report...");
    const reportContent = generateReport(apiData);

    // Step 4: Send email
    console.log("Sending email...");
    const emailResult = await sendEmail(reportContent);

    console.log("Report workflow completed successfully");

    return {
      success: true,
      todayRecords: todayData.length,
      emailSent: emailResult.success,
      messageId: emailResult.messageId,
    };
  } catch (error) {
    console.error("Error in report workflow:", error.message);
    throw error;
  }
}

// API Routes

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "API Report Mailer",
  });
});

// Trigger report workflow endpoint
app.post("/trigger-report", async (req, res) => {
  try {
    const result = await executeReportWorkflow();

    res.json({
      message: "Report workflow executed successfully",
      result,
    });
  } catch (error) {
    console.error("Error in /trigger-report:", error.message);
    res.status(500).json({
      error: "Failed to execute report workflow",
      details: error.message,
    });
  }
});

// GET endpoint for manual trigger (useful for GitHub Actions)
app.get("/trigger-report", async (req, res) => {
  try {
    const result = await executeReportWorkflow();

    res.json({
      message: "Report workflow executed successfully",
      result,
    });
  } catch (error) {
    console.error("Error in GET /trigger-report:", error.message);
    res.status(500).json({
      error: "Failed to execute report workflow",
      details: error.message,
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(
    `Trigger report: POST/GET http://localhost:${PORT}/trigger-report`
  );
  console.log("\nVerifying email configuration...");
  await verifyEmailConnection();
});

export default app;
