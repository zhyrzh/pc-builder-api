type Success<T> = {
  data: T;
  error: null;
};
type Fail<E> = {
  data: null;
  error: E;
};

type Result<T, E = Error> = Success<T> | Fail<E>;

export async function tryCatch<T, E = Error>(
  promise: Promise<T>,
  marker: string = ""
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    if (marker !== "") {
      console.log(error, marker, "err");
    }
    return { data: null, error: error as E };
  }
}
