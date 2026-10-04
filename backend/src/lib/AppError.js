/**
 * Application error carrying an HTTP status, a stable machine code and
 * optional structured details. Thrown from services/controllers and
 * translated to a JSON response by the error handler.
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = 'Yêu cầu không hợp lệ', details) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Chưa xác thực') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Không tìm thấy tài nguyên') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'Dữ liệu bị xung đột', details) {
    return new AppError(409, 'CONFLICT', message, details);
  }

  static locked(message = 'Tài khoản đã bị khóa') {
    return new AppError(423, 'LOCKED', message);
  }

  static payloadTooLarge(message = 'Tệp vượt quá dung lượng cho phép') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', message);
  }
}

export default AppError;
