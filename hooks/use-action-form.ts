import { zodResolver } from "@hookform/resolvers/zod";
import type { FormEventHandler } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import type { AutoFormBaseSchema } from "@/components/auto-form";

export type UseActionFormResult<S extends AutoFormBaseSchema> = {
	$schema: S;
	form: UseFormReturn<z.input<S>, unknown, z.output<S>>;
	handleSubmitWithAction: FormEventHandler<HTMLFormElement>;
};

export const useActionForm = <Schema extends AutoFormBaseSchema>(
	zodSchema: Schema,
	props: {
		defaultValues: z.input<Schema> | (() => z.input<Schema>);
		values?: z.output<Schema>;
		onSuccess?: () => unknown;
		saveAction: (
			props: z.output<Schema>,
			originalValues: z.input<Schema>,
			// biome-ignore lint/suspicious/noConfusingVoidType: We want this here
		) => Promise<z.input<Schema> | void>;
	},
): UseActionFormResult<Schema> => {
	const form = useForm<// @ts-expect-error improve it later
	z.output>({
		// @ts-expect-error
		resolver: async (values, context, options) => {
			const result = await zodResolver(zodSchema)(values, context, options);

			return {
				values: {
					originalValues: values,
					transformedValues: result.values,
				},
				errors: result.errors,
			};
		},
		defaultValues:
			props.values !== undefined
				? // @ts-expect-error
					zodSchema.encode(props.values)
				: typeof props.defaultValues === "function"
					? props.defaultValues()
					: props.defaultValues,
		mode: "onChange",
	});

	return {
		$schema: zodSchema,
		handleSubmitWithAction: form.handleSubmit(async (values) => {
			try {
				await props.saveAction(values.transformedValues, values.originalValues);
			} catch (error) {
				console.error(error, error instanceof Error ? error.cause : undefined);
				toast("Something bad happened while saving.");
				return;
			}

			toast("Saved in successfully!");
			if (props.onSuccess) {
				props.onSuccess();
			}
		}),
		// @ts-expect-error
		form,
	};
};
