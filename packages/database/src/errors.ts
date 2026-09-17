/** Thrown by a repository when a lookup matches no row inside the caller's tenant scope — this
 * covers both "doesn't exist" and "belongs to another organization/clinic": the caller never gets
 * to tell the difference, which is the point (never leak whether a foreign id exists). */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
