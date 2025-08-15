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
    // Argentina energy API uses 'fecha' field
    const itemDate = moment(item.fecha || item.date || item.created_at || item.timestamp);
    return itemDate.isBetween(start, end, null, "[]");
  });
}

// Function to filter data for today only
function filterTodayData(data) {
  if (!data || !data.result || !Array.isArray(data.result.records)) {
    console.warn("Data structure not as expected, returning empty array");
    return [];
  }

  const today = moment().format('YYYY-MM-DD');
  
  return data.result.records.filter((item) => {
    const itemDate = moment(item.fecha).format('YYYY-MM-DD');
    return itemDate === today;
  });
}

// Function to group data by field
function groupDataBy(data, field) {
  const grouped = {};
  data.forEach(item => {
    const key = item[field] || 'Sin especificar';
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  });
  return grouped;
}

// Function to analyze data and create statistics
function analyzeData(todayData) {
  const analysis = {
    totalRecords: todayData.length,
    byProduct: {},
    byProvince: {},
    byFlagCompany: {},
    flagCompanyStats: {
      totalCompanies: 0,
      companiesWithPrices: 0,
      percentage: 0
    }
  };

  // Group by product
  const productGroups = groupDataBy(todayData, 'producto');
  analysis.byProduct = Object.keys(productGroups).map(product => ({
    name: product,
    count: productGroups[product].length,
    records: productGroups[product]
  }));

  // Group by province
  const provinceGroups = groupDataBy(todayData, 'provincia');
  analysis.byProvince = Object.keys(provinceGroups).map(province => ({
    name: province,
    count: provinceGroups[province].length,
    records: provinceGroups[province]
  }));

  // Group by flag company
  const flagCompanyGroups = groupDataBy(todayData, 'empresabandera');
  analysis.byFlagCompany = Object.keys(flagCompanyGroups).map(company => ({
    name: company,
    count: flagCompanyGroups[company].length,
    records: flagCompanyGroups[company]
  }));

  // Calculate flag company statistics
  const uniqueCompanies = new Set(todayData.map(item => item.empresabandera).filter(Boolean));
  const companiesWithPrices = new Set(todayData.filter(item => item.precio).map(item => item.empresabandera));
  
  analysis.flagCompanyStats = {
    totalCompanies: uniqueCompanies.size,
    companiesWithPrices: companiesWithPrices.size,
    percentage: uniqueCompanies.size > 0 ? ((companiesWithPrices.size / uniqueCompanies.size) * 100).toFixed(2) : 0
  };

  return analysis;
}

// Function to generate professional HTML report
function generateReport(apiData, startDate, endDate) {
  const reportDate = moment().format("DD/MM/YYYY HH:mm:ss");
  const today = moment().format("DD/MM/YYYY");
  
  // Get today's data for analysis
  const todayData = filterTodayData(apiData);
  const analysis = analyzeData(todayData);

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
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .card {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            border-radius: 8px;
        }
        .card h3 {
            margin: 0 0 10px 0;
            color: #667eea;
            font-size: 1.2em;
        }
        .card .number {
            font-size: 2.5em;
            font-weight: bold;
            color: #333;
            margin: 10px 0;
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
                    <h3>Total de Registros</h3>
                    <div class="number">${analysis.totalRecords}</div>
                    <p>Registros del día de hoy</p>
                </div>
                <div class="card">
                    <h3>Productos</h3>
                    <div class="number">${analysis.byProduct.length}</div>
                    <p>Tipos de combustible</p>
                </div>
                <div class="card">
                    <h3>Provincias</h3>
                    <div class="number">${analysis.byProvince.length}</div>
                    <p>Con datos reportados</p>
                </div>
                <div class="card">
                    <h3>Empresas Bandera</h3>
                    <div class="number">${analysis.flagCompanyStats.totalCompanies}</div>
                    <p>Empresas registradas</p>
                </div>
            </div>

            ${analysis.totalRecords > 0 ? `
            <div class="section">
                <h2>📈 Registros por Producto</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Cantidad de Registros</th>
                            <th>Porcentaje</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysis.byProduct.map(product => `
                        <tr>
                            <td>${product.name}</td>
                            <td>${product.count}</td>
                            <td class="percentage">${((product.count / analysis.totalRecords) * 100).toFixed(1)}%</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="section">
                <h2>🗺️ Registros por Provincia</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Provincia</th>
                            <th>Cantidad de Registros</th>
                            <th>Porcentaje</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysis.byProvince.sort((a, b) => b.count - a.count).map(province => `
                        <tr>
                            <td>${province.name}</td>
                            <td>${province.count}</td>
                            <td class="percentage">${((province.count / analysis.totalRecords) * 100).toFixed(1)}%</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="section">
                <h2>🏢 Registros por Empresa Bandera</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Empresa Bandera</th>
                            <th>Cantidad de Registros</th>
                            <th>Porcentaje</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysis.byFlagCompany.sort((a, b) => b.count - a.count).map(company => `
                        <tr>
                            <td>${company.name}</td>
                            <td>${company.count}</td>
                            <td class="percentage">${((company.count / analysis.totalRecords) * 100).toFixed(1)}%</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="section">
                <h2>📊 Estadísticas de Empresas Bandera</h2>
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
                            <td>Total de Empresas</td>
                            <td><strong>${analysis.flagCompanyStats.totalCompanies}</strong></td>
                            <td>Empresas bandera registradas en el sistema</td>
                        </tr>
                        <tr>
                            <td>Empresas con Precios</td>
                            <td><strong>${analysis.flagCompanyStats.companiesWithPrices}</strong></td>
                            <td>Empresas que publicaron precios hoy</td>
                        </tr>
                        <tr>
                            <td>Porcentaje de Cobertura</td>
                            <td><strong class="percentage">${analysis.flagCompanyStats.percentage}%</strong></td>
                            <td>Porcentaje de empresas que reportaron precios</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            ` : `
            <div class="no-data">
                <h3>No hay datos disponibles para el día de hoy</h3>
                <p>No se encontraron registros nuevos para la fecha ${today}</p>
            </div>
            `}
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
    subject: `📊 Reporte Precios Combustibles - ${today}`,
    text: `Reporte de precios de combustibles del ${today}. Ver archivo adjunto HTML para el reporte completo.`,
    html: reportContent
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
    return {
      success: true,
      totalRecords: Array.isArray(filteredData) ? filteredData.length : 1,
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
