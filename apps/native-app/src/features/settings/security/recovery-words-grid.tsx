import { RESTORE_WORD_COUNT } from "@payky/app-shared/restore-words"
import { Text, XStack } from "tamagui"
import { fontSize } from "../../../theme/tokens.ts"

/**
 * Web's `RecoveryWordsGrid`: 20 numbered tiles in two columns. `words` is
 * `null` while the phrase is hidden, which shows masks and holds no word.
 * The words are not selectable.
 */
export function RecoveryWordsGrid({
  words,
}: {
  readonly words: ReadonlyArray<string> | null
}) {
  return (
    <XStack flexWrap="wrap" gap={8}>
      {Array.from({ length: RESTORE_WORD_COUNT }, (_, index) => (
        <XStack
          // biome-ignore lint/suspicious/noArrayIndexKey: the slots are fixed positions
          key={index}
          w="48%"
          items="center"
          gap={8}
        >
          <Text
            w={20}
            fontSize={fontSize.xs}
            lineHeight={fontSize.xs}
            color="muted-foreground"
            style={{ textAlign: "right" }}
          >
            {index + 1}
          </Text>
          <Text testID={`recovery-word-${index + 1}`} flex={1} select="none">
            {words === null ? "••••" : (words[index] ?? "")}
          </Text>
        </XStack>
      ))}
    </XStack>
  )
}
