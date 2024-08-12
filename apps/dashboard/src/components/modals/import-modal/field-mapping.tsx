"use client";

import { generateCsvMapping } from "@/actions/ai/generate-csv-mapping";
import { SelectAccount } from "@/components/select-account";
import { SelectCurrency } from "@/components/select-currency";
import { formatAmount } from "@/utils/format";
import { formatAmountValue, formatDate } from "@midday/import";
import { Icons } from "@midday/ui/icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@midday/ui/select";
import { Spinner } from "@midday/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@midday/ui/tooltip";
import { readStreamableValue } from "ai/rsc";
import { capitalCase } from "change-case";
import { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import { mappableFields, useCsvContext } from "./context";

export function FieldMapping({ currencies }: { currencies: string[] }) {
  const { fileColumns, firstRows, setValue, control, watch } = useCsvContext();
  const [isStreaming, setIsStreaming] = useState(true);
  const [showCurrency, setShowCurrency] = useState(false);

  useEffect(() => {
    if (!fileColumns || !firstRows) return;

    generateCsvMapping(fileColumns, firstRows)
      .then(async ({ object }) => {
        setIsStreaming(true);

        for await (const partialObject of readStreamableValue(object)) {
          if (partialObject) {
            for (const [field, value] of Object.entries(partialObject)) {
              if (
                Object.keys(mappableFields).includes(field) &&
                fileColumns.includes(value)
              ) {
                setValue(field as keyof typeof mappableFields, value, {
                  shouldValidate: true,
                });
              }
            }
          }
        }
      })
      .finally(() => setIsStreaming(false));
  }, [fileColumns, firstRows]);

  return (
    <div className="mt-6">
      <Controller
        control={control}
        name="bank_account_id"
        render={({ field: { value, onChange } }) => (
          <SelectAccount
            className="w-full"
            placeholder="Select account"
            value={value}
            onChange={(account) => {
              onChange(account.id);

              if (account?.currency) {
                setValue("currency", account.currency, {
                  shouldValidate: true,
                });

                setShowCurrency(false);
              } else {
                // Show currency select if account has no currency
                setShowCurrency(!account.currency);
              }
            }}
          />
        )}
      />

      {showCurrency && (
        <Controller
          control={control}
          name="currency"
          render={({ field: { onChange, value } }) => (
            <SelectCurrency
              className="w-full mt-4"
              value={value}
              onChange={onChange}
              currencies={Object.values(currencies)?.map(
                (currency) => currency,
              )}
            />
          )}
        />
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-6 mt-6 border-t-[1px] border-border">
        <div className="text-sm">CSV Data column</div>
        <div className="text-sm">Midday data column</div>
        {(Object.keys(mappableFields) as (keyof typeof mappableFields)[]).map(
          (field) => (
            <FieldRow
              key={field}
              field={field}
              isStreaming={isStreaming}
              currency={watch("currency")}
            />
          ),
        )}
      </div>
    </div>
  );
}

function FieldRow({
  field,
  isStreaming,
  currency,
}: {
  field: keyof typeof mappableFields;
  isStreaming: boolean;
  currency?: string;
}) {
  const { label, required } = mappableFields[field];
  const { control, watch, fileColumns, firstRows } = useCsvContext();

  const value = watch(field);

  const isLoading = isStreaming && !value;

  const firstRow = firstRows?.at(0);

  const description = firstRow?.[value as keyof typeof firstRow];

  const formatDescription = (description?: string) => {
    if (!description) return;

    if (field === "date") {
      return formatDate(description);
    }

    if (field === "amount" || field === "balance") {
      const amount = formatAmountValue(description);

      if (currency) {
        return formatAmount({ currency, amount });
      }

      return amount;
    }

    if (field === "description") {
      return capitalCase(description);
    }

    return description;
  };

  return (
    <>
      <div className="relative flex min-w-0 items-center gap-2">
        <Controller
          control={control}
          name={field}
          rules={{ required }}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full relative" hideIcon={isLoading}>
                <SelectValue placeholder={`Select ${label}`} />

                {isLoading && (
                  <div className="absolute right-2">
                    <Spinner />
                  </div>
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{label}</SelectLabel>
                  {[
                    ...(fileColumns || []),
                    ...(field.value && !required ? ["None"] : []),
                  ]?.map((column) => {
                    return (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        />

        <div className="flex items-center justify-end">
          <Icons.ArrowRightAlt className="size-4 text-[#878787]" />
        </div>
      </div>

      <span className="flex h-9 w-full items-center justify-between whitespace-nowrap border border-border bg-transparent px-3 py-2 text-sm">
        <div className="grow whitespace-nowrap text-sm font-normal text-muted-foreground justify-between flex">
          <span>{label}</span>

          {description && (
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger>
                  <Icons.Info />
                </TooltipTrigger>
                <TooltipContent className="p-2 text-xs">
                  {formatDescription(description)}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </span>
    </>
  );
}