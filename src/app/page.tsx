import styles from "./page.module.css";
import Link from "next/link";

export default function Home() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>AI YouTube Studio</h1>
        <p className={styles.description}>
          Welcome to the automated YouTube video generation platform.
        </p>
        <div style={{ marginTop: '2rem' }}>
          <Link href="/dashboard">
            <button style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 500 }}>
              Go to Dashboard
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
