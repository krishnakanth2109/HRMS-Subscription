import InductionDispatch from "../models/InductionDispatch.js";

/**
 * @desc    Get all induction dispatch history for an admin
 * @route   GET /api/induction
 * @access  Private (Admin)
 */
export const getInductionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, inductionType } = req.query;
    
    // Filter by adminId
    const query = { adminId: req.user._id };
    
    if (inductionType) {
      query.inductionType = inductionType;
    }

    const dispatches = await InductionDispatch.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const totalCount = await InductionDispatch.countDocuments(query);

    res.status(200).json({
      success: true,
      data: dispatches,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching induction history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch induction history.",
      error: error.message,
    });
  }
};

/**
 * @desc    Get details of a specific induction dispatch
 * @route   GET /api/induction/:id
 * @access  Private (Admin)
 */
export const getInductionById = async (req, res) => {
  try {
    const dispatch = await InductionDispatch.findOne({
      _id: req.params.id,
      adminId: req.user._id,
    });

    if (!dispatch) {
      return res.status(404).json({
        success: false,
        message: "Induction record not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: dispatch,
    });
  } catch (error) {
    console.error("❌ Error fetching induction details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch induction record details.",
      error: error.message,
    });
  }
};

/**
 * @desc    Delete an induction dispatch record
 * @route   DELETE /api/induction/:id
 * @access  Private (Admin)
 */
export const deleteInductionRecord = async (req, res) => {
  try {
    const dispatch = await InductionDispatch.findOneAndDelete({
      _id: req.params.id,
      adminId: req.user._id,
    });

    if (!dispatch) {
      return res.status(404).json({
        success: false,
        message: "Induction record not found or already deleted.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Induction record deleted successfully.",
    });
  } catch (error) {
    console.error("❌ Error deleting induction record:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete induction record.",
      error: error.message,
    });
  }
};
