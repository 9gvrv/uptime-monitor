
interface ApiResponseOptions<T> {
  statusCode: number;
  message?: string;
  data?: T;
}

class ApiResponse<T = unknown> {
  public readonly success = true;
  public readonly statusCode: number;
  public readonly message: string;
  public readonly data: T;

  constructor({
    statusCode = 200,
    message = "Success",
    data,
  }: ApiResponseOptions<T>) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data as T;
  }
}

export { ApiResponse };
