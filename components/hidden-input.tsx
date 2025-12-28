"use client";

import { Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const HiddenInput = () => {
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [secretData, setSecretData] = useState(
		"This is hidden sensitive information!",
	);
	const [showSecretData, setShowSecretData] = useState(false);
	const [apiKey, setApiKey] = useState("sk-1234567890abcdef");
	const [showApiKey, setShowApiKey] = useState(false);

	const apikeyId = useId();
	const passwordId = useId();

	const togglePasswordVisibility = () => {
		setShowPassword(!showPassword);
	};

	const toggleSecretData = () => {
		setShowSecretData(!showSecretData);
	};

	const toggleApiKey = () => {
		setShowApiKey(!showApiKey);
	};

	const maskValue = (value: string, visibleChars = 4) => {
		if (value.length <= visibleChars) return "*".repeat(value.length);
		return (
			value.slice(0, visibleChars) + "*".repeat(value.length - visibleChars)
		);
	};

	return (
		<div className="max-w-2xl mx-auto p-6 space-y-6">
			<div className="text-center space-y-2">
				<h1 className="text-3xl font-bold">Hidden Input Demo</h1>
				<p className="text-muted-foreground">
					Text inputs with hidden values and reveal functionality
				</p>
			</div>

			{/* Password Input with Toggle */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Lock className="w-5 h-5" />
						Password Input
					</CardTitle>
					<CardDescription>
						Enter a password and use the toggle button to show/hide it
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor={passwordId}>Password</Label>
						<div className="relative">
							<Input
								id={passwordId}
								type={showPassword ? "text" : "password"}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="Enter your password"
								className="pr-10"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
								onClick={togglePasswordVisibility}
								aria-label={showPassword ? "Hide password" : "Show password"}
							>
								{showPassword ? (
									<EyeOff className="h-4 w-4 text-muted-foreground" />
								) : (
									<Eye className="h-4 w-4 text-muted-foreground" />
								)}
							</Button>
						</div>
					</div>
					<div className="text-sm text-muted-foreground">
						Current value:{" "}
						{password
							? showPassword
								? password
								: "*".repeat(password.length)
							: "None"}
					</div>
				</CardContent>
			</Card>

			{/* Hidden Secret Data */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Unlock className="w-5 h-5" />
						Secret Information
					</CardTitle>
					<CardDescription>
						Click the button to reveal hidden sensitive information
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label>Secret Data</Label>
						<div className="flex items-center gap-2">
							<Input
								value={
									showSecretData ? secretData : "*".repeat(secretData.length)
								}
								readOnly
								className="font-mono"
							/>
							<Button
								variant="outline"
								size="icon"
								onClick={toggleSecretData}
								aria-label={
									showSecretData ? "Hide secret data" : "Show secret data"
								}
							>
								{showSecretData ? (
									<EyeOff className="h-4 w-4" />
								) : (
									<Eye className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>
					<div className="text-sm text-muted-foreground">
						Status: {showSecretData ? "Revealed" : "Hidden"}
					</div>
				</CardContent>
			</Card>

			{/* API Key with Partial Masking */}
			<Card>
				<CardHeader>
					<CardTitle>API Key Management</CardTitle>
					<CardDescription>
						API key with partial masking - shows first 4 characters when hidden
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor={apikeyId}>API Key</Label>
						<div className="flex items-center gap-2">
							<Input
								id={apikeyId}
								value={showApiKey ? apiKey : maskValue(apiKey, 4)}
								onChange={(e) => setApiKey(e.target.value)}
								className="font-mono"
								placeholder="Enter API key"
							/>
							<Button
								variant="outline"
								size="icon"
								onClick={toggleApiKey}
								aria-label={showApiKey ? "Hide API key" : "Show API key"}
							>
								{showApiKey ? (
									<EyeOff className="h-4 w-4" />
								) : (
									<Eye className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>
					<div className="text-sm text-muted-foreground">
						Visibility: {showApiKey ? "Full key visible" : "Partially masked"}
					</div>
				</CardContent>
			</Card>

			{/* Action Buttons */}
			<Card>
				<CardHeader>
					<CardTitle>Actions</CardTitle>
					<CardDescription>Control all hidden values at once</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							onClick={() => {
								setShowPassword(true);
								setShowSecretData(true);
								setShowApiKey(true);
							}}
						>
							<Eye className="w-4 h-4 mr-2" />
							Reveal All
						</Button>
						<Button
							variant="outline"
							onClick={() => {
								setShowPassword(false);
								setShowSecretData(false);
								setShowApiKey(false);
							}}
						>
							<EyeOff className="w-4 h-4 mr-2" />
							Hide All
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								setPassword("");
								setSecretData("");
								setApiKey("");
							}}
						>
							Clear All Values
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};
