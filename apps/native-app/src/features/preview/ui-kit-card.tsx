import ArrowLeft from "lucide-react-native/icons/arrow-left"
import Check from "lucide-react-native/icons/check"
import ChevronRight from "lucide-react-native/icons/chevron-right"
import Plus from "lucide-react-native/icons/plus"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { Text, View } from "tamagui"
import { CollisionAlert } from "../../components/collision-alert.tsx"
import { DetailRow } from "../../components/detail-row.tsx"
import { ListSkeleton } from "../../components/list-skeleton.tsx"
import { NotFoundCard } from "../../components/not-found-card.tsx"
import { OptionToggleGroup } from "../../components/option-toggle-group.tsx"
import { PasswordTextarea } from "../../components/password-textarea.tsx"
import { SearchInput } from "../../components/search-input.tsx"
import {
  SlidingPillSegmentContent,
  SlidingPillTrack,
} from "../../components/sliding-pill.tsx"
import { SuccessPanel } from "../../components/success-panel.tsx"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/alert.tsx"
import { Badge } from "../../components/ui/badge.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.tsx"
import { Checkbox } from "../../components/ui/checkbox.tsx"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "../../components/ui/field.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { Input } from "../../components/ui/input.tsx"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "../../components/ui/input-otp.tsx"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select.tsx"
import { Separator } from "../../components/ui/separator.tsx"
import { Skeleton } from "../../components/ui/skeleton.tsx"
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
} from "../../components/ui/stepper.tsx"
import { Switch } from "../../components/ui/switch.tsx"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs.tsx"
import { Textarea } from "../../components/ui/textarea.tsx"
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "../../components/ui/timeline.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/toggle-group.tsx"
import { VerticalNav } from "../../components/vertical-nav.tsx"

const variants = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const

/** Dev-only: every ui kit component in one place, to eyeball on the device. */
export function UiKitCard() {
  const [on, setOn] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [choice, setChoice] = useState<"a" | "b" | "c" | null>("a")
  const [otp, setOtp] = useState("")
  const [search, setSearch] = useState("")
  const [secret, setSecret] = useState("")
  return (
    <View bg="card" rounded="lg" p="4" gap="3">
      <Text fontWeight="600">UI kit</Text>
      <View flexDirection="row" gap="4" items="center">
        <Icon icon={ArrowLeft} size={20} color="primary" strokeWidth={3} />
        <Icon icon={Check} color="success" />
        <Icon icon={ChevronRight} size={20} color="muted-foreground" />
      </View>
      {variants.map((variant) => (
        <View key={variant} flexDirection="row" gap="2" items="center">
          <Button variant={variant} label={variant} />
          <Button variant={variant} size="sm" label="sm" iconStart={Plus} />
          <Button
            variant={variant}
            size="icon"
            iconStart={Plus}
            aria-label={`${variant} icon`}
          />
        </View>
      ))}
      <Button size="lg" label="Large" iconEnd={ChevronRight} />
      <Button size="lg" variant="outline" label="Pending" pending />
      <Button size="lg" label="Disabled" disabled />
      <Card>
        <CardHeader>
          <CardTitle>Card title</CardTitle>
          <CardDescription>Card description</CardDescription>
          <CardAction>
            <Button size="xs" variant="outline" label="Action" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Text>Card content</Text>
        </CardContent>
        <CardFooter>
          <Button variant="outline" label="Footer" />
        </CardFooter>
      </Card>
      <View flexDirection="row" gap="2" flexWrap="wrap">
        {(["default", "secondary", "destructive", "outline"] as const).map(
          (variant) => (
            <Badge
              key={variant}
              variant={variant}
              label={variant}
              icon={Check}
            />
          )
        )}
      </View>
      <Separator />
      <View flexDirection="row" gap="3" items="center" h={40}>
        <Skeleton w={40} h={40} rounded={9999} />
        <View flex={1} gap="2">
          <Skeleton h={12} />
          <Skeleton h={12} w="60%" />
        </View>
        <Separator orientation="vertical" />
        <Text>Vertical</Text>
      </View>
      <View flexDirection="row" gap="4" items="center">
        <Switch checked={on} onCheckedChange={setOn} aria-label="Switch" />
        <Switch
          checked={!on}
          onCheckedChange={(next) => setOn(!next)}
          aria-label="Inverse switch"
        />
        <Checkbox checked={on} onCheckedChange={setOn} aria-label="Checkbox" />
        <Checkbox
          checked={false}
          onCheckedChange={() => {}}
          disabled
          aria-label="Disabled checkbox"
        />
      </View>
      <ToggleGroup value={choice} onValueChange={setChoice} variant="outline">
        <ToggleGroupItem value="a">One</ToggleGroupItem>
        <ToggleGroupItem value="b">Two</ToggleGroupItem>
        <ToggleGroupItem value="c">Three</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        value={choice}
        onValueChange={setChoice}
        variant="outline"
        size="sm"
        spacing={0}
      >
        <ToggleGroupItem value="a">Joined</ToggleGroupItem>
        <ToggleGroupItem value="b">Segments</ToggleGroupItem>
        <ToggleGroupItem value="c">Here</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        value={choice}
        onValueChange={setChoice}
        variant="outline"
        columns={2}
      >
        <ToggleGroupItem value="a">Grid A</ToggleGroupItem>
        <ToggleGroupItem value="b">Grid B</ToggleGroupItem>
        <ToggleGroupItem value="c">Grid C</ToggleGroupItem>
      </ToggleGroup>
      <OptionToggleGroup
        value={choice}
        onChange={setChoice}
        options={[
          {
            value: "a",
            title: "Option A",
            description: "Has a description",
            icon: Plus,
          },
          { value: "b", title: "Option B" },
        ]}
      />
      <Tabs defaultValue="first">
        <TabsList>
          <TabsTrigger value="first">First tab</TabsTrigger>
          <TabsTrigger value="second">Second tab</TabsTrigger>
        </TabsList>
        <TabsContent value="first">
          <Text>First content</Text>
        </TabsContent>
        <TabsContent value="second">
          <Text>Second content</Text>
        </TabsContent>
      </Tabs>
      <Button
        variant="outline"
        label="Open dialog"
        onPress={() => setDialogOpen(true)}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent closeLabel="Close">
          <DialogHeader>
            <DialogTitle>Dialog title</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogHeader>
          <Input placeholder="Keyboard check" />
          <DialogFooter>
            <Button
              variant="outline"
              label="Cancel"
              onPress={() => setDialogOpen(false)}
            />
            <Button label="Save" onPress={() => setDialogOpen(false)} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Select
        value={choice}
        onValueChange={setChoice}
        items={{ a: "Apple", b: "Banana", c: "Cherry" }}
      >
        <SelectTrigger aria-label="Fruit" fullWidth>
          <SelectValue placeholder="Pick a fruit" />
        </SelectTrigger>
        <SelectContent title="Fruit">
          <SelectGroup>
            <SelectLabel>Fruit</SelectLabel>
            <SelectItem value="a">Apple</SelectItem>
            <SelectItem value="b">Banana</SelectItem>
            <SelectItem value="c">Cherry</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Collapsible>
        <CollapsibleTrigger flexDirection="row" justify="space-between">
          <Text fontSize="sm" lineHeight="sm" fontWeight="600">
            Advanced
          </Text>
          <Icon icon={ChevronRight} />
        </CollapsibleTrigger>
        <CollapsibleContent pt={8}>
          <Text>Collapsible content</Text>
        </CollapsibleContent>
      </Collapsible>
      <Input placeholder="Input" />
      <Input placeholder="Invalid" invalid />
      <Input placeholder="Disabled" disabled />
      <Textarea placeholder="Textarea" />
      {(
        [
          "default",
          "destructive",
          "info",
          "success",
          "warning",
          "invert",
        ] as const
      ).map((variant) => (
        <Alert key={variant} variant={variant} icon={TriangleAlert}>
          <AlertTitle>{`Alert ${variant}`}</AlertTitle>
          <AlertDescription>Alert description</AlertDescription>
        </Alert>
      ))}
      <VerticalNav
        title="VERTICAL NAV"
        items={[
          {
            kind: "button",
            label: "Button row",
            icon: <Icon icon={Plus} size={20} color="muted-foreground" />,
          },
          {
            kind: "static",
            label: "Static row with action",
            action: <Badge label="Badge" />,
          },
          { kind: "href", label: "External link", href: "https://finito.fit" },
        ]}
      />
      <VerticalNav items={[]} empty="Empty list" />
      <ListSkeleton rows={3} title="LIST SKELETON" />
      <Card>
        <CardContent gap={8}>
          <DetailRow label="Detail row" value="Value" />
          <DetailRow label="Emphasized" value="1 234,00 Kč" emphasize />
          <DetailRow
            label="Stacked"
            value="A long value under its label"
            stacked
          />
          <DetailRow label="Mono" value="0f3a9c2e7b1d4e5f" mono />
        </CardContent>
      </Card>
      <NotFoundCard messageKey="paymentDetail.notFound" />
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search"
        clearAriaLabel="Clear"
      />
      <PasswordTextarea
        value={secret}
        onChangeText={setSecret}
        placeholder="Secret"
        hideLabel="Hide"
        showLabel="Show"
      />
      <CollisionAlert title="Collision" description="Collision description">
        <Button size="lg" label="Resolve" />
        <Button size="lg" variant="outline" label="Refund" />
      </CollisionAlert>
      <SuccessPanel title="Paid" description="Success panel description" />
      <View self="center">
        <SlidingPillTrack padding={4} bg="neutral-soft">
          <View flexDirection="row">
            {(["Pos", "Numpad"] as const).map((label, index) => (
              <View key={label} px={16} h={36} justify="center">
                <SlidingPillSegmentContent
                  active={index === 0}
                  pillId="preview-pill"
                  icon={(color) => <Icon icon={Plus} color={color} />}
                  label={label}
                />
              </View>
            ))}
          </View>
        </SlidingPillTrack>
      </View>
      <Stepper value={2}>
        <StepperNav>
          {[1, 2, 3].map((step) => (
            <StepperItem key={step} step={step} last={step === 3}>
              <StepperIndicator size={8} inactiveColor="muted-foreground-30" />
              {step < 3 ? <StepperSeparator /> : null}
            </StepperItem>
          ))}
        </StepperNav>
      </Stepper>
      <Timeline value={2}>
        {[1, 2, 3].map((step) => (
          <TimelineItem key={step} step={step} last={step === 3}>
            <TimelineHeader>
              <TimelineDate>{`Date ${step}`}</TimelineDate>
              <TimelineTitle>
                {`Timeline step ${step}`}
                <Badge variant="secondary" label="Badge" />
              </TimelineTitle>
            </TimelineHeader>
            <TimelineIndicator />
            <TimelineSeparator />
            <TimelineContent>
              <Text color="muted-foreground">Timeline content</Text>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
      <Alert variant="warning">
        <AlertDescription>Without icon, with an action</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" label="Retry" />
        </AlertAction>
      </Alert>
      <InputOTP
        value={otp}
        maxLength={4}
        aria-label="Code"
        onChange={(next) => setOtp(next.replace(/\D/gu, ""))}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} first />
          <InputOTPSlot index={1} last />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={2} first invalid />
          <InputOTPSlot index={3} last invalid />
        </InputOTPGroup>
      </InputOTP>
      <FieldGroup>
        <Field>
          <FieldLabel>Field label</FieldLabel>
          <Input placeholder="Labelled input" />
          <FieldDescription>Field description</FieldDescription>
        </Field>
        <FieldSeparator>or</FieldSeparator>
        <Field>
          <FieldLabel>Invalid field</FieldLabel>
          <Input invalid />
          <FieldError>Field error</FieldError>
        </Field>
      </FieldGroup>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Small card</CardTitle>
        </CardHeader>
        <CardContent>
          <Text>No footer</Text>
        </CardContent>
      </Card>
    </View>
  )
}
