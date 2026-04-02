export type InterceptorHandler<T> = {
  onFulfilled?: (value: T) => T | Promise<T>;
  onRejected?: (error: unknown) => unknown;
};

export class InterceptorManager<T> {
  private readonly handlers = new Map<number, InterceptorHandler<T>>();
  private counter = 0;

  use(
    onFulfilled?: (value: T) => T | Promise<T>,
    onRejected?: (error: unknown) => unknown,
  ): number {
    const id = this.counter++;
    this.handlers.set(id, { onFulfilled, onRejected });
    return id;
  }

  eject(id: number): void {
    this.handlers.delete(id);
  }

  clear(): void {
    this.handlers.clear();
  }

  forEach(fn: (interceptor: InterceptorHandler<T>) => void): void {
    this.handlers.forEach(fn);
  }
}
