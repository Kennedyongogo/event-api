const {
  Payment,
  TicketPurchase,
  Event,
  EventOrganizer,
  PublicUser,
  TicketType,
} = require("../models");
const { sequelize } = require("../models");
const { Op } = require("sequelize");

// Mock Pesapal payment initiation
const initiatePayment = async (req, res) => {
  try {
    const { purchase_id, payment_method } = req.body;

    // Verify purchase exists
    const purchase = await TicketPurchase.findByPk(purchase_id, {
      include: [
        {
          model: Event,
          as: "event",
          include: [
            {
              model: EventOrganizer,
              as: "organizer",
            },
          ],
        },
      ],
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    if (purchase.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Purchase already paid",
      });
    }

    // Get event commission rate (commission is per event, not per organizer)
    const commissionRate = purchase.event.commission_rate || 10.0;
    const amount = parseFloat(purchase.total_amount);

    // Calculate split
    const adminShare = (amount * commissionRate) / 100;
    const organizerShare = amount - adminShare;

    // Create payment record
    const payment = await Payment.create({
      purchase_id,
      amount,
      commission_amount: adminShare,
      organizer_share: organizerShare,
      admin_share: adminShare,
      payment_method: payment_method || "M-Pesa",
      status: "pending",
      pesapal_transaction_id: `MOCK-TXN-${Date.now()}`, // Mock transaction ID
    });

    // TODO: In production, call actual Pesapal API here with split_details
    /*
    const pesapalResponse = await axios.post('https://pesapal-api/payment', {
      amount: amount,
      currency: "KES",
      description: `Ticket purchase for ${purchase.event.event_name}`,
      callback_url: `${config.baseUrl}/api/payments/callback`,
      split_details: [
        {
          merchant_reference: purchase.event.organizer.pesapal_merchant_ref,
          percentage: 100 - commissionRate
        },
        {
          merchant_reference: process.env.PLATFORM_PESAPAL_MERCHANT_ID,
          percentage: commissionRate
        }
      ]
    });
    */

    res.status(201).json({
      success: true,
      message: "Payment initiated successfully",
      data: {
        payment_id: payment.id,
        purchase_id: purchase.id,
        amount: payment.amount,
        organizer_share: payment.organizer_share,
        admin_share: payment.admin_share,
        status: payment.status,
        // Mock payment URL (in production, return Pesapal redirect URL)
        payment_url: `http://localhost:3008/api/payments/mock-pay/${payment.id}`,
      },
    });
  } catch (error) {
    console.error("Error initiating payment:", error);
    res.status(500).json({
      success: false,
      message: "Error initiating payment",
      error: error.message,
    });
  }
};

// Mock payment execution (simulate user completing payment)
const mockPayment = async (req, res) => {
  try {
    const { id } = req.params; // payment_id
    const { success = true } = req.body; // Simulate success or failure

    const payment = await Payment.findByPk(id, {
      include: [
        {
          model: TicketPurchase,
          as: "purchase",
        },
      ],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (success) {
      // Update payment status
      await payment.update({
        status: "completed",
        pesapal_transaction_id: `MOCK-SUCCESS-${Date.now()}`,
      });

      // Update purchase status
      await payment.purchase.update({ status: "paid" });

      res.status(200).json({
        success: true,
        message: "Payment completed successfully",
        data: {
          payment_id: payment.id,
          purchase_id: payment.purchase_id,
          amount: payment.amount,
          status: payment.status,
        },
      });
    } else {
      // Payment failed
      await payment.update({ status: "failed" });

      // Restore ticket quantity
      const purchase = await TicketPurchase.findByPk(payment.purchase_id, {
        include: [{ model: TicketType, as: "ticketType" }],
      });

      await purchase.ticketType.update({
        remaining_quantity:
          purchase.ticketType.remaining_quantity + purchase.quantity,
      });

      res.status(200).json({
        success: false,
        message: "Payment failed",
        data: {
          payment_id: payment.id,
          status: payment.status,
        },
      });
    }
  } catch (error) {
    console.error("Error processing mock payment:", error);
    res.status(500).json({
      success: false,
      message: "Error processing mock payment",
      error: error.message,
    });
  }
};

// Pesapal callback handler (IPN)
const paymentCallback = async (req, res) => {
  try {
    const { pesapal_transaction_id, status, purchase_id } = req.body;

    // Find payment by transaction ID or purchase ID
    const payment = await Payment.findOne({
      where: {
        [Op.or]: [{ pesapal_transaction_id }, { purchase_id }],
      },
      include: [
        {
          model: TicketPurchase,
          as: "purchase",
          include: [
            {
              model: TicketType,
              as: "ticketType",
            },
          ],
        },
      ],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (status === "COMPLETED" || status === "completed") {
      // Update payment status
      await payment.update({
        status: "completed",
        pesapal_transaction_id,
      });

      // Update purchase status
      await payment.purchase.update({ status: "paid" });

      res.status(200).json({
        success: true,
        message: "Payment callback processed successfully",
      });
    } else {
      // Payment failed - restore tickets
      await payment.update({ status: "failed" });

      await payment.purchase.ticketType.update({
        remaining_quantity:
          payment.purchase.ticketType.remaining_quantity +
          payment.purchase.quantity,
      });

      res.status(200).json({
        success: false,
        message: "Payment failed",
      });
    }
  } catch (error) {
    console.error("Error processing payment callback:", error);
    res.status(500).json({
      success: false,
      message: "Error processing payment callback",
      error: error.message,
    });
  }
};

// Get all payments
const getAllPayments = async (req, res) => {
  try {
    const { page, limit, status } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const totalCount = await Payment.count({ where: whereClause });

    const payments = await Payment.findAll({
      where: whereClause,
      include: [
        {
          model: TicketPurchase,
          as: "purchase",
          attributes: ["id", "quantity", "total_amount"],
          include: [
            {
              model: PublicUser,
              as: "user",
              attributes: ["full_name", "email"],
            },
            {
              model: Event,
              as: "event",
              attributes: ["event_name"],
            },
          ],
        },
      ],
      limit: limitNum,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: payments,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payments",
      error: error.message,
    });
  }
};

// Get payment by ID
const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findByPk(id, {
      include: [
        {
          model: TicketPurchase,
          as: "purchase",
          include: [
            {
              model: PublicUser,
              as: "user",
              attributes: ["full_name", "email", "phone"],
            },
            {
              model: Event,
              as: "event",
              attributes: ["event_name", "venue", "event_date"],
              include: [
                {
                  model: EventOrganizer,
                  as: "organizer",
                  attributes: ["organization_name"],
                },
              ],
            },
            {
              model: TicketType,
              as: "ticketType",
              attributes: ["name", "price"],
            },
          ],
        },
      ],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Error fetching payment:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payment",
      error: error.message,
    });
  }
};

// Get revenue analytics
const getRevenueAnalytics = async (req, res) => {
  try {
    const { organizer_id, start_date, end_date } = req.query;

    const whereClause = { status: "completed" };

    if (start_date && end_date) {
      whereClause.createdAt = {
        [Op.between]: [new Date(start_date), new Date(end_date)],
      };
    }

    let payments = await Payment.findAll({
      where: whereClause,
      include: [
        {
          model: TicketPurchase,
          as: "purchase",
          include: [
            {
              model: Event,
              as: "event",
              where: organizer_id ? { organizer_id } : {},
            },
          ],
        },
      ],
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "totalRevenue"],
        [sequelize.fn("SUM", sequelize.col("admin_share")), "totalAdminShare"],
        [
          sequelize.fn("SUM", sequelize.col("organizer_share")),
          "totalOrganizerShare",
        ],
        [
          sequelize.fn("COUNT", sequelize.col("Payment.id")),
          "totalTransactions",
        ],
      ],
      raw: true,
    });

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: parseFloat(payments[0].totalRevenue || 0).toFixed(2),
        totalAdminShare: parseFloat(payments[0].totalAdminShare || 0).toFixed(
          2
        ),
        totalOrganizerShare: parseFloat(
          payments[0].totalOrganizerShare || 0
        ).toFixed(2),
        totalTransactions: parseInt(payments[0].totalTransactions || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching revenue analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching revenue analytics",
      error: error.message,
    });
  }
};

// Refund payment
const refundPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const payment = await Payment.findByPk(id, {
      include: [
        {
          model: TicketPurchase,
          as: "purchase",
          include: [
            {
              model: TicketType,
              as: "ticketType",
            },
          ],
        },
      ],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Only completed payments can be refunded",
      });
    }

    // Update payment status
    await payment.update({ status: "refunded" });

    // Update purchase status
    await payment.purchase.update({ status: "refunded" });

    // Restore ticket quantity
    await payment.purchase.ticketType.update({
      remaining_quantity:
        payment.purchase.ticketType.remaining_quantity +
        payment.purchase.quantity,
    });

    // TODO: In production, call Pesapal refund API

    res.status(200).json({
      success: true,
      message: "Payment refunded successfully",
      data: {
        payment_id: payment.id,
        refund_amount: payment.amount,
        status: payment.status,
      },
    });
  } catch (error) {
    console.error("Error refunding payment:", error);
    res.status(500).json({
      success: false,
      message: "Error refunding payment",
      error: error.message,
    });
  }
};

module.exports = {
  initiatePayment,
  mockPayment,
  paymentCallback,
  getAllPayments,
  getPaymentById,
  getRevenueAnalytics,
  refundPayment,
};
