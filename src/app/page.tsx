import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>AI YouTube Studio</h1>
        <p className={styles.description}>
          Welcome to the automated YouTube video generation platform.
        </p>
      </main>
    </div>
  );
}
