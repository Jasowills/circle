import { useEffect, useState } from "react";
import {
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import * as Crypto from "expo-crypto";
import {
  API_URL,
  api,
  getAccessToken,
  type CircleDetail,
  type Cycle,
  type WalletOverview,
} from "../api";
import { useTheme } from "../theme";
import { useAuth } from "../auth";
import { AnimatedBar, AnimatedMoneyBar, FadeIn, Loading } from "../anim";
import { Avatar } from "../Avatar";
import { countdownText, statusLabel } from "../format";

export function CircleDetailScreen({
  circleId,
  onOpenProfile,
}: {
  circleId: string;
  onOpenProfile?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { s, palette } = useTheme();
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["circle", circleId],
    queryFn: () => api.get<CircleDetail>(`/circles/${circleId}`),
  });
  const cycles = useQuery({
    queryKey: ["cycles", circleId],
    queryFn: () => api.get<Cycle[]>(`/circles/${circleId}/cycles`),
    enabled: !!detail.data?.contributionAmount,
  });
  const wallet = useQuery({
    queryKey: ["wallet"],
    queryFn: () => api.get<WalletOverview>("/wallet"),
  });

  // Live room keeps every number on this screen fresh. There is no feed UI
  // on purpose: updates land directly in balances, pots and schedules.
  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null;
    let alive = true;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["circle", circleId] });
      qc.invalidateQueries({ queryKey: ["cycles", circleId] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    };
    getAccessToken().then((token) => {
      if (!alive || !token) return;
      socket = io(API_URL, { transports: ["websocket"] });
      socket.on("connect", () => socket?.emit("join", { circleId, token }));
      socket.on("contribution.created", refresh);
      socket.on("member.joined", refresh);
      socket.on("circle.status_changed", refresh);
      socket.on("payout.completed", refresh);
      socket.on("cycle.advanced", refresh);
    });
    return () => {
      alive = false;
      socket?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId]);

  const contribute = useMutation({
    mutationFn: async (amt: number) =>
      api.post<{ replayed: boolean }>(`/circles/${circleId}/contribute`, {
        amount: amt,
        idempotencyKey: Crypto.randomUUID(),
      }),
    onSuccess: (r) => {
      setMsg(
        r.replayed
          ? "That one already went through. No double charge."
          : "Contribution saved.",
      );
      qc.invalidateQueries({ queryKey: ["circle", circleId] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const accept = useMutation({
    mutationFn: () => api.post(`/circles/${circleId}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["circle", circleId] });
      qc.invalidateQueries({ queryKey: ["circles"] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const setAuto = useMutation({
    mutationFn: (body: { contribute?: boolean; collect?: boolean }) =>
      api.patch(`/circles/${circleId}/auto`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circle", circleId] }),
    onError: (e: Error) => setMsg(e.message),
  });

  const claim = useMutation({
    mutationFn: (cycleId: string) =>
      api.post(`/circles/${circleId}/cycles/${cycleId}/claim`),
    onSuccess: () => {
      setMsg("Pot collected into your wallet.");
      qc.invalidateQueries({ queryKey: ["circle", circleId] });
      qc.invalidateQueries({ queryKey: ["cycles", circleId] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const saveRotation = useMutation({
    mutationFn: (body: { mode: string; order: string[] }) =>
      api.patch(`/circles/${circleId}/rotation`, body),
    onSuccess: () => {
      setMsg("Rotation order saved. It locks when the circle fills.");
      qc.invalidateQueries({ queryKey: ["circle", circleId] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const d = detail.data;
  const nextOpensAt = d?.myNextContributionAt ? new Date(d.myNextContributionAt) : null;
  const blocked = !!nextOpensAt && nextOpensAt > new Date();
  if (detail.isLoading) return <Loading label="Loading circle…" />;
  if (detail.error || !d) {
    return (
      <View style={s.screen}>
        <View style={s.error}>
          <Text style={s.errorText}>
            {(detail.error as Error)?.message ?? "Not found"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 32 }}>
      <FadeIn>
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.h2}>{d.name}</Text>
            <Text
              style={[
                s.pill,
                d.status === "active" && s.pillSolid,
                (d.status === "goal_reached" || d.status === "completed") &&
                  s.pillMoney,
              ]}
            >
              {statusLabel(d.status)}
            </Text>
          </View>
          <AnimatedBar progress={d.progress} />
          <Text style={s.text}>
            {Number(d.balance).toLocaleString()}{" "}
            <Text style={s.muted}>
              of {Number(d.goalAmount).toLocaleString()} {d.currency}
            </Text>
          </Text>
          <Text style={s.muted}>
            Your share: {Number(d.myBalance).toLocaleString()}
          </Text>
        </View>
      </FadeIn>

      {(d.status === "completed" || d.status === "goal_reached") && (
        <View style={s.card}>
          <Text style={s.h3}>Rotation complete</Text>
          <Text style={s.muted}>
            Every cycle paid out. This circle is done collecting.
          </Text>
        </View>
      )}

      {d.currentCycle ? (
        <FadeIn delay={120}>
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.h3}>
                Cycle {d.currentCycle.cycleNumber} of{" "}
                {d.currentCycle.totalCycles}
              </Text>
              <Text style={[s.pill, s.pillSolid]}>collecting</Text>
            </View>
            <Text style={s.text}>
              {d.currentCycle.recipient.id === user?.id ? (
                <>
                  Your turn{" "}
                  <Text style={{ color: palette.money, fontWeight: "700" }}>
                    · pot comes to you
                  </Text>
                </>
              ) : (
                <>{d.currentCycle.recipient.name} collects this cycle</>
              )}
            </Text>
            <AnimatedMoneyBar
              progress={d.currentCycle.collected / d.currentCycle.targetPot}
            />
            <Text style={s.muted}>
              {Number(d.currentCycle.collected).toLocaleString()} of{" "}
              {Number(d.currentCycle.targetPot).toLocaleString()} {d.currency}{" "}
              pot
              {countdownText(d.currentCycle.endsAt)
                ? ` · ${countdownText(d.currentCycle.endsAt)}`
                : ""}
            </Text>
          </View>
        </FadeIn>
      ) : null}

      {msg ? (
        <View style={s.card}>
          <Text style={s.text}>{msg}</Text>
        </View>
      ) : null}

      {d.myMembership.status === "invited" && (
        <View style={s.card}>
          <Text style={s.text}>You've been invited to this circle.</Text>
          <TouchableOpacity style={s.btn} onPress={() => accept.mutate()}>
            <Text style={s.btnText}>Accept invite</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.h3}>Contribute</Text>
          <Text style={s.muted}>
            Wallet ₦{Number(wallet.data?.balance ?? 0).toLocaleString()}
          </Text>
        </View>
        {d.contributionAmount ? (
          <Text style={[s.h2, { marginTop: 8 }]}>
            ₦{Number(d.contributionAmount).toLocaleString()}
          </Text>
        ) : null}
        {d.contributionAmount ? (
          <Text style={[s.muted, { marginBottom: 4 }]}>
            Fixed step
            {d.contributionsPerWeek
              ? ` · ${d.contributionsPerWeek}× per week`
              : ""}
            . This circle takes exactly this amount per tap.
          </Text>
        ) : (
          <TextInput
            style={s.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="1000"
            placeholderTextColor={palette.placeholder}
          />
        )}
        {blocked && nextOpensAt ? (
          <Text style={[s.muted, { marginBottom: 4 }]}>
            Next contribution opens{" "}
            {nextOpensAt.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            .
          </Text>
        ) : null}
        <TouchableOpacity
          style={[s.btn, blocked ? { opacity: 0.4 } : null]}
          disabled={contribute.isPending || d.myMembership.status !== "active" || blocked}
          onPress={() =>
            contribute.mutate(d.contributionAmount ?? Number(amount))
          }
        >
          <Text style={s.btnText}>
            {contribute.isPending
              ? "Sending…"
              : d.contributionAmount
                ? `Contribute ₦${Number(d.contributionAmount).toLocaleString()}`
                : "Contribute"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.h3}>Members</Text>
        {d.members.map((m) => (
          <TouchableOpacity
            key={m.userId}
            style={[
              s.row,
              { paddingVertical: 6, justifyContent: "flex-start", gap: 10 },
            ]}
            onPress={() => onOpenProfile?.(m.userId)}
            disabled={!onOpenProfile}
          >
            <Avatar name={m.user.name} avatarUrl={m.user.avatarUrl} />
            <View style={{ flex: 1 }}>
              <Text style={s.text}>
                {m.user.name}{" "}
                <Text style={s.muted}>
                  · {m.role} · {statusLabel(m.status)}
                </Text>
              </Text>
            </View>
            <Text style={s.text}>{Number(m.balance).toLocaleString()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {d.myMembership.status === "active" && d.contributionAmount ? (
        <View style={s.card}>
          <Text style={s.h3}>Autopilot</Text>
          <Text style={[s.muted, { marginBottom: 8 }]}>
            Set it once. The circle handles the rest.
          </Text>
          <View style={[s.row, { paddingVertical: 6 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>Auto-contribute</Text>
              <Text style={s.muted}>Pay the fixed step on schedule</Text>
            </View>
            <Switch
              value={d.myAutopilot.contribute}
              onValueChange={(v) => setAuto.mutate({ contribute: v })}
              trackColor={{ true: palette.money, false: palette.panel2 }}
            />
          </View>
          <View style={[s.row, { paddingVertical: 6 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>Auto-collect payouts</Text>
              <Text style={s.muted}>Off means pots wait for your tap</Text>
            </View>
            <Switch
              value={d.myAutopilot.collect}
              onValueChange={(v) => setAuto.mutate({ collect: v })}
              trackColor={{ true: palette.money, false: palette.panel2 }}
            />
          </View>
        </View>
      ) : null}

      <View style={s.card}>
        <Text style={s.h3}>Circle facts</Text>
        {[
          [
            "Daily step",
            d.contributionAmount
              ? `₦${Number(d.contributionAmount).toLocaleString()}`
              : "Free amount",
          ],
          ["Cycle length", `${d.cycleLengthDays} days`],
          [
            "Seats",
            d.targetMembers
              ? `${d.members.filter((m) => m.status === "active").length} of ${d.targetMembers} filled`
              : `${d.members.length} members`,
          ],
          [
            "Started",
            new Date(d.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          ],
          [
            "Your role",
            `${d.myMembership.role} · ${statusLabel(d.myMembership.status)}`,
          ],
        ].map(([k, v]) => (
          <View key={k} style={[s.row, { paddingVertical: 4 }]}>
            <Text style={s.muted}>{k}</Text>
            <Text style={s.text}>{v}</Text>
          </View>
        ))}
      </View>

      {d.myMembership.role === "creator" &&
      d.status === "forming" &&
      d.contributionAmount ? (
        <RotationEditor
          members={d.members
            .filter((m) => m.status === "active")
            .map((m) => ({ id: m.userId, name: m.user.name }))}
          currentMode={d.rotationMode}
          onSave={(mode, order) => saveRotation.mutate({ mode, order })}
          saving={saveRotation.isPending}
        />
      ) : null}

      {(cycles.data ?? []).length > 0 && (
        <View style={s.card}>
          <Text style={s.h3}>Rotation schedule</Text>
          {(cycles.data ?? []).map((c) => {
            const mine = c.recipient.id === user?.id;
            const waiting =
              mine && c.status === "payout_completed" && !c.payoutClaimedAt;
            return (
              <View key={c.id} style={[s.row, { paddingVertical: 8 }]}>
                <View
                  style={{
                    borderWidth: c.status === "collecting" ? 2 : 0,
                    borderColor: palette.money,
                    borderRadius: 18,
                    padding: c.status === "collecting" ? 2 : 0,
                    marginRight: 12,
                  }}
                >
                  <Avatar name={c.recipient.name} size={32} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.text}>
                    Cycle {c.cycleNumber} · {mine ? "You" : c.recipient.name}
                  </Text>
                  <Text style={s.muted}>
                    {c.status === "payout_completed"
                      ? c.payoutClaimedAt
                        ? "paid out"
                        : "won · waiting for you"
                      : c.status === "collecting"
                        ? `${Number(c.collected).toLocaleString()} / ${Number(c.targetPot).toLocaleString()}`
                        : "upcoming"}
                  </Text>
                </View>
                {waiting ? (
                  <TouchableOpacity
                    style={[
                      s.btn,
                      {
                        marginTop: 0,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        backgroundColor: palette.money,
                      },
                    ]}
                    onPress={() => claim.mutate(c.id)}
                    disabled={claim.isPending}
                  >
                    <Text style={[s.btnText, { color: "#06281a" }]}>
                      Collect
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text
                    style={[
                      s.pill,
                      c.status === "collecting" && s.pillSolid,
                      c.status === "payout_completed" && s.pillMoney,
                    ]}
                  >
                    {statusLabel(c.status)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

/** Creator-only rotation setup while forming: draw mode + manual order. */
export function RotationEditor({
  members,
  currentMode,
  onSave,
  saving,
}: {
  members: { id: string; name: string }[];
  currentMode: string;
  onSave: (mode: string, order: string[]) => void;
  saving: boolean;
}) {
  const { s, palette } = useTheme();
  const [mode, setMode] = useState<"random_draw" | "manual">(
    currentMode === "manual" ? "manual" : "random_draw",
  );
  const [order, setOrder] = useState<string[]>(members.map((m) => m.id));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const byId = Object.fromEntries(members.map((m) => [m.id, m.name]));

  return (
    <View style={s.card}>
      <Text style={s.h3}>Payout order</Text>
      <Text style={s.muted}>
        Drawn once when the circle fills. Set it now or let chance decide.
      </Text>
      <View style={[s.row, { gap: 12, marginVertical: 8 }]}>
        <TouchableOpacity
          style={[
            mode === "random_draw" ? s.btn : s.btnGhost,
            { flex: 1, marginTop: 0, padding: 13 },
          ]}
          onPress={() => setMode("random_draw")}
        >
          <Text style={mode === "random_draw" ? s.btnText : s.btnGhostText}>
            Random draw
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            mode === "manual" ? s.btn : s.btnGhost,
            { flex: 1, marginTop: 0, padding: 13 },
          ]}
          onPress={() => setMode("manual")}
        >
          <Text style={mode === "manual" ? s.btnText : s.btnGhostText}>
            I decide
          </Text>
        </TouchableOpacity>
      </View>
      {mode === "manual" &&
        order.map((id, i) => (
          <View key={id} style={[s.row, { paddingVertical: 6 }]}>
            <Text
              style={[
                s.text,
                { width: 28, color: palette.money, fontWeight: "800" },
              ]}
            >
              {i + 1}
            </Text>
            <Text style={[s.text, { flex: 1 }]}>{byId[id] ?? id}</Text>
            <TouchableOpacity
              onPress={() => move(i, -1)}
              disabled={i === 0}
              hitSlop={8}
            >
              <Text
                style={{
                  color: i === 0 ? palette.faint : palette.text,
                  fontSize: 18,
                }}
              >
                ▲
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => move(i, 1)}
              disabled={i === order.length - 1}
              hitSlop={8}
            >
              <Text
                style={{
                  color: i === order.length - 1 ? palette.faint : palette.text,
                  fontSize: 18,
                }}
              >
                ▼
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      <TouchableOpacity
        style={s.btn}
        onPress={() => onSave(mode, order)}
        disabled={saving}
      >
        <Text style={s.btnText}>{saving ? "Saving…" : "Save order"}</Text>
      </TouchableOpacity>
    </View>
  );
}
