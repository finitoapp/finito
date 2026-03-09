import type { Typed, TypeName } from "@evolu/common";
import type { EmptyObject } from "type-fest";

export type ErrorFactory<
	TType extends TypeName,
	TShape extends object,
> = keyof TShape extends never
	? () => Typed<TType>
	: EmptyObject extends TShape
		? () => Typed<TType>
		: (shape: TShape) => Typed<TType> & TShape;

/**
 * Creates a typed error factory with an optional payload shape.
 *
 * Example:
 * const createRpcResponseTimeoutError = defineError("RpcResponseTimeoutError")<{
 * 	method: string;
 * }>();
 *
 * const error = createRpcResponseTimeoutError({ method: "ping" });
 * // { type: "RpcResponseTimeoutError", method: "ping" }
 */
export const defineError =
	<TType extends TypeName>(type: TType) =>
	<TShape extends object = EmptyObject>() =>
		((shape?: TShape) => ({
			type,
			...(shape ?? {}),
		})) as ErrorFactory<TType, TShape>;
