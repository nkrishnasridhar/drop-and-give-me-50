export default function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
        Drop and Give Me 50
      </h1>
      <p style={{ opacity: 0.6, maxWidth: "32ch" }}>
        Phase 0 scaffold. The log screen arrives in Phase 1.
      </p>
    </main>
  );
}
