"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<
        "idle" | "sending" | "sent" | "error"
    >("idle");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) router.replace("/dashboard");
        });
    }, [router]);

    async function sendMagicLink(e: React.FormEvent) {
        e.preventDefault();
        setStatus("sending");
        setErrorMessage("");

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo:
                    typeof window !== "undefined"
                        ? `${window.location.origin}/dashboard`
                        : undefined
            }
        });

        if (error) {
            setStatus("error");
            setErrorMessage(error.message);
            return;
        }
        setStatus("sent");
    }

    return (
        <div className="flex min-h-screen items-center justify-center px-6">
            <div className="w-full max-w-sm">
                <div className="mb-8">
                    <p className="label mb-1">whatsapp platform</p>
                    <h1 className="text-2xl font-semibold tracking-tight text-ink">
                        Sign in to the console
                    </h1>
                </div>

                {status === "sent" ? (
                    <div className="card p-5">
                        <p className="text-sm text-ink">
                            Check <span className="font-medium">{email}</span>{" "}
                            for a sign-in link.
                        </p>
                        <button
                            onClick={() => setStatus("idle")}
                            className="mt-3 text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
                        >
                            Use a different email
                        </button>
                    </div>
                ) : (
                    <form onSubmit={sendMagicLink} className="card p-5">
                        <label className="label mb-2 block" htmlFor="email">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="mb-4 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                        />
                        <button
                            type="submit"
                            disabled={status === "sending"}
                            className="w-full rounded-md bg-ink px-3 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
                        >
                            {status === "sending"
                                ? "Sending…"
                                : "Send sign-in link"}
                        </button>
                        {status === "error" && (
                            <p className="mt-3 text-sm text-warn">
                                {errorMessage}
                            </p>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
}
