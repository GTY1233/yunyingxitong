// 统一错误模型。业务层抛 AppError，server 的 setErrorHandler 统一转成 {ok:false,error:{code,message}}。
export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = "INTERNAL") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }

  static notFound(message = "资源不存在") {
    return new AppError(message, 404, "NOT_FOUND");
  }
  static badRequest(message = "请求参数错误") {
    return new AppError(message, 400, "BAD_REQUEST");
  }
  static unauthorized(message = "未授权") {
    return new AppError(message, 401, "UNAUTHORIZED");
  }
}
