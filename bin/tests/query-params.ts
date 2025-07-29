export class BuildQueryParams {
  static build(this: void, callback: (params: BuildQueryParams) => BuildQueryParams): string {
    const params = new BuildQueryParams();
    return callback(params).build();
  }

  #params: string[] = [];

  build(): string {
    return this.#params.join('&');
  }

  push(name: string, value?: string) {
    if (value === undefined) {
      this.#params.push(`${name}`);
    } else {
      this.#params.push(`${name}=${encodeURIComponent(value)}`);
    }

    return this;
  }

  addFlag(condition: unknown, name: string) {
    if (condition) {
      this.#params.push(name);
    }

    return this;
  }

  addOption(condition: unknown, name: string, value?: string) {
    if (condition) {
      this.push(name, value ?? String(condition));
    }

    return this;
  }

  addList<T>(list: T[] | undefined, name: string, callback?: (item: T) => string) {
    if (list !== undefined) {
      for (const item of list) {
        this.#params.push(
          `${name}=${encodeURIComponent(callback ? callback(item) : String(item))}`
        );
      }
    }

    return this;
  }

  addRaw(param: string | undefined) {
    if (param !== undefined) {
      this.#params.push(param);
    }

    return this;
  }
}

export const buildQueryParams = BuildQueryParams.build;
