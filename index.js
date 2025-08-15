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
  if (!Array.isArray(data)) {
    console.warn("Data is not an array, returning as is");
    return data;
  }

  const start = moment(startDate);
  const end = moment(endDate);

  return data.filter((item) => {
    // Adjust this field name based on your API response structure
    const itemDate = moment(item.date || item.created_at || item.timestamp);
    return itemDate.isBetween(start, end, null, "[]");
  });
}

// Function to generate report
function generateReport(filteredData, startDate, endDate) {
  const reportDate = moment().format("YYYY-MM-DD HH:mm:ss");
  const totalRecords = Array.isArray(filteredData) ? filteredData.length : 1;

  let reportContent = `
# Reporte de Datos API
**Fecha del reporte:** ${reportDate}
**Período:** ${startDate} - ${endDate}
**Total de registros:** ${totalRecords}

## Resumen de datos:
`;

  if (Array.isArray(filteredData)) {
    filteredData.forEach((item, index) => {
      reportContent += `
### Registro ${index + 1}
${JSON.stringify(item, null, 2)}
`;
    });
  } else {
    reportContent += `
### Datos obtenidos:
${JSON.stringify(filteredData, null, 2)}
`;
  }

  return reportContent;
}

// Function to send email
async function sendEmail(reportContent, startDate, endDate) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_RECIPIENTS,
    subject: `Reporte API - ${startDate} a ${endDate}`,
    text: reportContent,
    html: reportContent
      .replace(/\n/g, "<br>")
      .replace(/###/g, "<h3>")
      .replace(/##/g, "<h2>")
      .replace(/#/g, "<h1>"),
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
    const reportContent = generateReport(filteredData, startDate, endDate);

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
