import styles from './page.module.css';
import { login, signup } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>;
}) {
  const params = await searchParams;
  const message = params?.message;

  return (
    <div className={styles.container}>
      <form className={styles.form}>
        <h2 className={styles.title}>Welcome Back</h2>

        <div className={styles.inputGroup}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required />
        </div>

        <div className={styles.actions}>
          <button formAction={login} className={styles.primaryButton}>
            Log in
          </button>
          <button formAction={signup} className={styles.secondaryButton}>
            Sign up
          </button>
        </div>

        {message && <p className={styles.message}>{message}</p>}
      </form>
    </div>
  );
}
