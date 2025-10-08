const {
  Project,
  Task,
  Budget,
  Material,
  Equipment,
  Labor,
  Admin,
} = require("../models");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

// Generate project quotation PDF
const generateProjectQuotation = async (req, res) => {
  try {
    console.log("🚀 Starting PDF generation...");
    const { projectId } = req.params;
    const { quotationType = "both" } = req.query;
    console.log("📋 Project ID:", projectId);
    console.log("📋 Quotation Type:", quotationType);

    // Fetch project with all related data
    console.log("🔍 Fetching project data...");
    const project = await Project.findByPk(projectId, {
      include: [
        {
          model: Admin,
          as: "engineer",
          attributes: ["name", "email", "phone"],
        },
        {
          model: Task,
          as: "tasks",
          include: [
            {
              model: Budget,
              as: "budgets",
              include: [
                {
                  model: Material,
                  as: "material",
                  attributes: ["name", "unit", "unit_cost"],
                },
                {
                  model: Equipment,
                  as: "equipment",
                  attributes: ["name", "type", "rental_cost_per_day"],
                },
                {
                  model: Labor,
                  as: "labor",
                  attributes: ["worker_name", "worker_type", "hourly_rate"],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!project) {
      console.log("❌ Project not found");
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }
    console.log("✅ Project found:", project.name);

    // Calculate budget summaries
    console.log("📊 Calculating budget summary...");
    const budgetSummary = calculateBudgetSummary(project.tasks, quotationType);
    console.log("✅ Budget summary calculated");

    // Generate HTML content for PDF
    console.log("📝 Generating HTML content...");
    const htmlContent = generateQuotationHTML(
      project,
      budgetSummary,
      quotationType
    );
    console.log("✅ HTML content generated, length:", htmlContent.length);

    // Generate PDF using Puppeteer
    console.log("🌐 Launching Puppeteer browser...");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("✅ Browser launched successfully");

    console.log("📄 Creating new page...");
    const page = await browser.newPage();
    console.log("✅ Page created");

    console.log("📝 Setting page content...");
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    console.log("✅ Page content set");

    console.log("📄 Generating PDF...");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "15mm",
        bottom: "20mm",
        left: "15mm",
      },
    });
    console.log("✅ PDF generated, buffer size:", pdfBuffer.length);

    console.log("🔒 Closing browser...");
    await browser.close();
    console.log("✅ Browser closed");

    // Set response headers for PDF download
    console.log("📤 Setting response headers...");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="quotation-${project.name.replace(/\s+/g, "-")}-${
        new Date().toISOString().split("T")[0]
      }.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    console.log("✅ Headers set");

    console.log("📤 Sending PDF response...");
    res.send(pdfBuffer);
    console.log("✅ PDF sent successfully!");
  } catch (error) {
    console.error("❌ Error generating quotation:", error);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ Error name:", error.name);
    console.error("❌ Error message:", error.message);

    res.status(500).json({
      success: false,
      message: "Error generating quotation PDF",
      error: error.message,
    });
  }
};

// Get quotation data without PDF generation
const getQuotationData = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { quotationType = "both" } = req.query;

    const project = await Project.findByPk(projectId, {
      include: [
        {
          model: Admin,
          as: "engineer",
          attributes: ["name", "email", "phone"],
        },
        {
          model: Task,
          as: "tasks",
          include: [
            {
              model: Budget,
              as: "budgets",
              include: [
                {
                  model: Material,
                  as: "material",
                  attributes: ["name", "unit", "unit_cost"],
                },
                {
                  model: Equipment,
                  as: "equipment",
                  attributes: ["name", "type", "rental_cost_per_day"],
                },
                {
                  model: Labor,
                  as: "labor",
                  attributes: ["worker_name", "worker_type", "hourly_rate"],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const budgetSummary = calculateBudgetSummary(project.tasks, quotationType);

    res.status(200).json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          location_name: project.location_name,
          client_name: project.client_name,
          contractor_name: project.contractor_name,
          start_date: project.start_date,
          end_date: project.end_date,
          currency: project.currency,
          engineer: project.engineer,
        },
        budgetSummary,
        tasks: project.tasks.map((task) => ({
          id: task.id,
          name: task.name,
          description: task.description,
          status: task.status,
          progress_percent: task.progress_percent,
          budgets: task.budgets.map((budget) => ({
            id: budget.id,
            category: budget.category,
            amount: budget.amount,
            type: budget.type,
            date: budget.date,
            resource: budget.material || budget.equipment || budget.labor,
          })),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching quotation data:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching quotation data",
      error: error.message,
    });
  }
};

// Calculate budget summary for all tasks
const calculateBudgetSummary = (tasks, quotationType = "both") => {
  let totalBudgeted = 0;
  let totalActual = 0;
  const taskSummaries = [];
  const categoryBreakdown = {};

  tasks.forEach((task) => {
    const taskBudgeted = task.budgets
      .filter((b) => b.type === "budgeted")
      .reduce((sum, b) => sum + parseFloat(b.amount), 0);

    const taskActual = task.budgets
      .filter((b) => b.type === "actual")
      .reduce((sum, b) => sum + parseFloat(b.amount), 0);

    // Filter based on quotation type
    if (quotationType === "budgeted") {
      totalBudgeted += taskBudgeted;
      totalActual = 0; // Don't include actual costs
    } else if (quotationType === "actual") {
      totalBudgeted = 0; // Don't include budgeted costs
      totalActual += taskActual;
    } else {
      totalBudgeted += taskBudgeted;
      totalActual += taskActual;
    }

    // Group by category
    task.budgets.forEach((budget) => {
      const category = budget.category;
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { budgeted: 0, actual: 0 };
      }
      if (budget.type === "budgeted") {
        categoryBreakdown[category].budgeted += parseFloat(budget.amount);
      } else {
        categoryBreakdown[category].actual += parseFloat(budget.amount);
      }
    });

    // Calculate values based on quotation type
    let displayBudgeted = taskBudgeted;
    let displayActual = taskActual;

    if (quotationType === "budgeted") {
      displayActual = 0;
    } else if (quotationType === "actual") {
      displayBudgeted = 0;
    }

    taskSummaries.push({
      taskId: task.id,
      taskName: task.name,
      budgeted: displayBudgeted,
      actual: displayActual,
      variance: displayActual - displayBudgeted,
      variancePercentage:
        displayBudgeted > 0
          ? (
              ((displayActual - displayBudgeted) / displayBudgeted) *
              100
            ).toFixed(2)
          : 0,
    });
  });

  return {
    totalBudgeted,
    totalActual,
    totalVariance: totalActual - totalBudgeted,
    totalVariancePercentage:
      totalBudgeted > 0
        ? (((totalActual - totalBudgeted) / totalBudgeted) * 100).toFixed(2)
        : 0,
    categoryBreakdown,
    taskSummaries,
  };
};

// Generate HTML content for PDF
const generateQuotationHTML = (
  project,
  budgetSummary,
  quotationType = "both"
) => {
  const currentDate = new Date().toLocaleDateString();

  // Get logo as base64
  const logoPath = path.resolve(
    __dirname,
    "..",
    "..",
    "public",
    "logos",
    "betheltus-logo.png"
  );
  let logoBase64 = "";

  try {
    console.log("🖼️ Looking for logo at:", logoPath);
    if (fs.existsSync(logoPath)) {
      console.log("✅ Logo file found");
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      console.log(
        "✅ Logo loaded successfully as base64, length:",
        logoBase64.length
      );
    } else {
      console.log("❌ Logo file not found at:", logoPath);
    }
  } catch (error) {
    console.error("❌ Error loading logo:", error);
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Project Quotation - ${project.name}</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #2c3e50;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .logo-section {
          margin-bottom: 15px;
        }
        .company-logo {
          max-height: 120px;
          max-width: 400px;
          object-fit: contain;
          margin-bottom: 15px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #2c3e50;
          margin-bottom: 10px;
        }
        .company-info {
          font-size: 12px;
          color: #666;
        }
        .quotation-title {
          font-size: 24px;
          font-weight: bold;
          color: #2c3e50;
          margin: 20px 0;
        }
        .project-info {
          background-color: #f8f9fa;
          padding: 20px;
          border-radius: 5px;
          margin-bottom: 30px;
        }
        .project-info h3 {
          margin-top: 0;
          color: #2c3e50;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .info-item {
          margin-bottom: 10px;
        }
        .info-label {
          font-weight: bold;
          color: #555;
        }
        .summary-section {
          margin: 30px 0;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }
        .summary-card {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          text-align: center;
          border-left: 4px solid #3498db;
        }
        .summary-card h4 {
          margin: 0 0 10px 0;
          color: #2c3e50;
          font-size: 14px;
        }
        .summary-card .amount {
          font-size: 18px;
          font-weight: bold;
          color: #27ae60;
        }
        .summary-card .variance {
          font-size: 12px;
          color: #e74c3c;
        }
        .tasks-section {
          margin: 30px 0;
        }
        .task-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        .task-table th,
        .task-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        .task-table th {
          background-color: #2c3e50;
          color: white;
          font-weight: bold;
        }
        .task-table tr:nth-child(even) {
          background-color: #f8f9fa;
        }
        .category-section {
          margin: 30px 0;
        }
        .category-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        .category-table th,
        .category-table td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        .category-table th {
          background-color: #34495e;
          color: white;
        }
        .footer {
          margin-top: 50px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #ddd;
          padding-top: 20px;
        }
        .positive {
          color: #27ae60;
        }
        .negative {
          color: #e74c3c;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          ${
            logoBase64
              ? `
          <img src="${logoBase64}" 
               alt="Betheltus Construction LTD" 
               class="company-logo">
          `
              : `
          <div class="logo">BETHELTUS CONSTRUCTION LTD</div>
          `
          }
        </div>
        <div class="company-info">
          Professional Construction Services<br>
          "YOUR VISION, OUR CONSTRUCTION"<br>
          Email: info@betheltusconstruction.com | Phone: +254 700 000 000
        </div>
      </div>

      <div class="quotation-title">Project Quotation & Budget Summary - ${
        quotationType === "budgeted"
          ? "Budgeted Costs"
          : quotationType === "actual"
          ? "Actual Costs"
          : "Budget vs Actual Comparison"
      }</div>

      <div class="project-info">
        <h3>Project Details</h3>
        <div class="info-grid">
          <div>
            <div class="info-item">
              <span class="info-label">Project Name:</span> ${project.name}
            </div>
            <div class="info-item">
              <span class="info-label">Client:</span> ${
                project.client_name || "N/A"
              }
            </div>
            <div class="info-item">
              <span class="info-label">Location:</span> ${
                project.location_name || "N/A"
              }
            </div>
            <div class="info-item">
              <span class="info-label">Start Date:</span> ${project.start_date}
            </div>
          </div>
          <div>
            <div class="info-item">
              <span class="info-label">Contractor:</span> ${
                project.contractor_name || "N/A"
              }
            </div>
            <div class="info-item">
              <span class="info-label">Engineer:</span> ${
                project.engineer?.name || "N/A"
              }
            </div>
            <div class="info-item">
              <span class="info-label">End Date:</span> ${
                project.end_date || "TBD"
              }
            </div>
            <div class="info-item">
              <span class="info-label">Currency:</span> ${project.currency}
            </div>
          </div>
        </div>
        ${
          project.description
            ? `<div class="info-item" style="margin-top: 15px;"><span class="info-label">Description:</span> ${project.description}</div>`
            : ""
        }
      </div>

      <div class="summary-section">
        <h3>Budget Summary</h3>
        <div class="summary-grid">
          ${
            quotationType === "both"
              ? `
          <div class="summary-card">
            <h4>Total Budgeted</h4>
            <div class="amount">${
              project.currency
            } ${budgetSummary.totalBudgeted.toLocaleString()}</div>
          </div>
          <div class="summary-card">
            <h4>Total Actual</h4>
            <div class="amount">${
              project.currency
            } ${budgetSummary.totalActual.toLocaleString()}</div>
          </div>
          <div class="summary-card">
            <h4>Variance</h4>
            <div class="amount ${
              budgetSummary.totalVariance >= 0 ? "positive" : "negative"
            }">
              ${
                project.currency
              } ${budgetSummary.totalVariance.toLocaleString()}
            </div>
            <div class="variance">${
              budgetSummary.totalVariancePercentage
            }%</div>
          </div>
          `
              : `
          <div class="summary-card">
            <h4>Total ${
              quotationType === "budgeted" ? "Budgeted" : "Actual"
            } Cost</h4>
            <div class="amount">${project.currency} ${(quotationType ===
                "budgeted"
                  ? budgetSummary.totalBudgeted
                  : budgetSummary.totalActual
                ).toLocaleString()}</div>
          </div>
          <div class="summary-card">
            <h4>Tasks Count</h4>
            <div class="amount">${budgetSummary.taskSummaries.length}</div>
          </div>
          <div class="summary-card">
            <h4>Quotation Type</h4>
            <div class="amount">${
              quotationType === "budgeted" ? "Estimate" : "Final"
            }</div>
          </div>
          `
          }
        </div>
      </div>

      <div class="tasks-section">
        <h3>Task-wise Budget Breakdown</h3>
        <table class="task-table">
          <thead>
            <tr>
              <th>Task Name</th>
              ${
                quotationType === "both"
                  ? `
              <th>Budgeted Amount</th>
              <th>Actual Amount</th>
              <th>Variance</th>
              <th>Variance %</th>
              `
                  : `
              <th>${
                quotationType === "budgeted" ? "Budgeted" : "Actual"
              } Amount</th>
              <th>Status</th>
              `
              }
            </tr>
          </thead>
          <tbody>
            ${budgetSummary.taskSummaries
              .map(
                (task) => `
              <tr>
                <td>${task.taskName}</td>
                ${
                  quotationType === "both"
                    ? `
                <td>${project.currency} ${task.budgeted.toLocaleString()}</td>
                <td>${project.currency} ${task.actual.toLocaleString()}</td>
                <td class="${task.variance >= 0 ? "positive" : "negative"}">
                  ${project.currency} ${task.variance.toLocaleString()}
                </td>
                <td class="${task.variance >= 0 ? "positive" : "negative"}">
                  ${task.variancePercentage}%
                </td>
                `
                    : `
                <td>${project.currency} ${(quotationType === "budgeted"
                        ? task.budgeted
                        : task.actual
                      ).toLocaleString()}</td>
                <td>${
                  quotationType === "budgeted" ? "Estimated" : "Completed"
                }</td>
                `
                }
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="category-section">
        <h3>Budget by Category</h3>
        <table class="category-table">
          <thead>
            <tr>
              <th>Category</th>
              ${
                quotationType === "both"
                  ? `
              <th>Budgeted Amount</th>
              <th>Actual Amount</th>
              <th>Variance</th>
              `
                  : `
              <th>${
                quotationType === "budgeted" ? "Budgeted" : "Actual"
              } Amount</th>
              <th>Count</th>
              `
              }
            </tr>
          </thead>
          <tbody>
            ${Object.entries(budgetSummary.categoryBreakdown)
              .map(([category, amounts]) => {
                const variance = amounts.actual - amounts.budgeted;
                const variancePercentage =
                  amounts.budgeted > 0
                    ? ((variance / amounts.budgeted) * 100).toFixed(2)
                    : 0;
                return `
                <tr>
                  <td>${category}</td>
                  ${
                    quotationType === "both"
                      ? `
                  <td>${
                    project.currency
                  } ${amounts.budgeted.toLocaleString()}</td>
                  <td>${
                    project.currency
                  } ${amounts.actual.toLocaleString()}</td>
                  <td class="${variance >= 0 ? "positive" : "negative"}">
                    ${
                      project.currency
                    } ${variance.toLocaleString()} (${variancePercentage}%)
                  </td>
                  `
                      : `
                  <td>${project.currency} ${(quotationType === "budgeted"
                          ? amounts.budgeted
                          : amounts.actual
                        ).toLocaleString()}</td>
                  <td>${
                    quotationType === "budgeted" ? "Estimated" : "Actual"
                  }</td>
                  `
                  }
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>Generated on ${currentDate} | Betheltus Construction Management System</p>
        <p>This quotation is valid for 30 days from the date of generation.</p>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  generateProjectQuotation,
  getQuotationData,
};
