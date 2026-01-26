// Utility to wrap async routes and standardized success response
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const sendSuccess = (res, data = null) => {
    res.status(200).json({
        success: true,
        data: data
    });
};

const sendError = (next, code, message, statusCode = 400) => {
    const error = new Error(message);
    error.errorCode = code;
    error.status = statusCode;
    next(error);
};

module.exports = { asyncHandler, sendSuccess, sendError };
