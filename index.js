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
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

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

// Function to filter data by date
function filterDataByDate(data, startDate, endDate) {
  if (!data || !data.result || !Array.isArray(data.result.records)) {
    console.warn("Data structure not as expected, returning empty array");
    return [];
  }

  const start = moment(startDate);
  const end = moment(endDate);

  return data.result.records.filter((item) => {
    // Argentina energy API uses 'fecha_vigencia' field
    // fecha_vigencia is in Argentina local time (UTC-3)
    // Convert to UTC by subtracting 3 hours to properly compare with UTC dates
    const itemDate = moment(item.fecha_vigencia).subtract(3, "hours");
    return itemDate.isBetween(start, end, null, "[]");
  });
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
    .map((product) => ({
      name: product,
      count: productGroups[product].length,
      records: productGroups[product],
    }))
    .sort((a, b) => b.count - a.count);

  // Group by province
  const provinceGroups = groupDataBy(todayData, "provincia");
  analysis.byProvince = Object.keys(provinceGroups)
    .map((province) => ({
      name: province,
      count: provinceGroups[province].length,
      records: provinceGroups[province],
    }))
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
    .map((company) => ({
      name: company,
      count: flagCompanyGroups[company].length,
      records: flagCompanyGroups[company],
    }))
    .sort((a, b) => b.count - a.count);

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
function generateReport(apiData, startDate, endDate) {
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
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
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
            gap: 15px;
            margin-bottom: 40px;
        }
        .card {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .card-content {
            flex: 1;
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
            <h1>📊 Reporte de Precios de Combustibles</h1>
            <p>Datos del día ${today} | Generado el ${reportDate}</p>
        </div>
        
        <div class="content">
            <div class="summary-cards">
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
                            <th>Actualizaciones Hoy</th>
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
                            <th>Actualizaciones Hoy</th>
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
                            <th>Actualizaciones Hoy</th>
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

// Function to send email
async function sendEmail(reportContent, startDate, endDate) {
  const today = moment().format("DD/MM/YYYY");
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_RECIPIENTS,
    subject: `🔴 Reporte Precios Combustibles - ${today}`,
    text: `Reporte de precios de combustibles del ${today}. Ver archivo adjunto HTML para el reporte completo.`,
    html: reportContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// Main workflow function
async function executeReportWorkflow(startDate, endDate) {
  try {
    console.log(
      `Starting report workflow for period: ${startDate} - ${endDate}`
    );

    // Step 1: Fetch data from API
    console.log("Fetching data from API...");
    const apiData = await fetchApiData();

    // Step 2: Filter data by date
    console.log("Filtering data by date...");
    const filteredData = filterDataByDate(apiData, startDate, endDate);

    // Step 3: Generate report
    console.log("Generating report...");
    const reportContent = generateReport(apiData, startDate, endDate);

    // Step 4: Send email
    console.log("Sending email...");
    const emailResult = await sendEmail(reportContent, startDate, endDate);

    console.log("Report workflow completed successfully");

    // Get today's data count for the result
    const todayData = filterTodayData(apiData);

    return {
      success: true,
      totalRecords: Array.isArray(filteredData) ? filteredData.length : 1,
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
    const { startDate, endDate } = req.body;

    // Default to last 7 days if no dates provided
    const start =
      startDate || moment().subtract(7, "days").format("YYYY-MM-DD");
    const end = endDate || moment().format("YYYY-MM-DD");

    // Validate dates
    if (!moment(start).isValid() || !moment(end).isValid()) {
      return res.status(400).json({
        error: "Invalid date format. Use YYYY-MM-DD format.",
      });
    }

    if (moment(start).isAfter(moment(end))) {
      return res.status(400).json({
        error: "Start date cannot be after end date.",
      });
    }

    const result = await executeReportWorkflow(start, end);

    res.json({
      message: "Report workflow executed successfully",
      period: { startDate: start, endDate: end },
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
    const { startDate, endDate } = req.query;

    // Default to last 7 days if no dates provided
    const start =
      startDate || moment().subtract(7, "days").format("YYYY-MM-DD");
    const end = endDate || moment().format("YYYY-MM-DD");

    const result = await executeReportWorkflow(start, end);

    res.json({
      message: "Report workflow executed successfully",
      period: { startDate: start, endDate: end },
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(
    `Trigger report: POST/GET http://localhost:${PORT}/trigger-report`
  );
});

export default app;
