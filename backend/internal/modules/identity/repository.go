package identity

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/google/uuid"
)

// Bootstrap operations are restricted SECURITY DEFINER functions, never raw runtime DML.
// The service owns the transaction; false/invalid results must commit security counters/revocations.
type Repository struct{}

func withExecutor(ctx context.Context, fn func(context.Context, database.DBTX) error) error {
	q, err := database.TxFromContext(ctx)
	if err != nil {
		return err
	}
	return fn(ctx, q)
}
func (r *Repository) budget(ctx context.Context, key string) (bool, error) {
	var ok bool
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_budget($1)`, digest(key)).Scan(&ok)
	})
	return ok, err
}
func (r *Repository) pruneAttempts(ctx context.Context, olderThan time.Duration) (int, error) {
	var count int
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		intervalStr := fmt.Sprintf("%d seconds", int(olderThan.Seconds()))
		return q.QueryRowContext(ctx, `SELECT identity.auth_prune_attempts($1::interval)`, intervalStr).Scan(&count)
	})
	return count, err
}
// RegisterTx executes transactional account registration using direct parameterized SQL statements.
// It checks if the email already exists in identity.user_contacts, and if not, creates the user,
// primary contact (marked as verified), and credentials identity within the provided transaction.
// Returns (userID, true, nil) on success, or (uuid.Nil, false, nil) if the email is already registered.
func (r *Repository) RegisterTx(ctx context.Context, tx database.DBTX, email, first, last, passwordHash string) (uuid.UUID, bool, error) {
	var exists bool
	err := tx.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM identity.user_contacts 
			WHERE type = 'email' AND lower(normalized_value) = lower($1)
		)
	`, email).Scan(&exists)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("check email exists: %w", err)
	}
	if exists {
		return uuid.Nil, false, nil
	}

	userID := uuid.New()
	contactID := uuid.New()
	identityID := uuid.New()

	_, err = tx.ExecContext(ctx, `
		INSERT INTO identity.users (id, first_name, last_name, status)
		VALUES ($1, $2, NULLIF($3, ''), 'active')
	`, userID, first, last)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("insert user: %w", err)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO identity.user_contacts (id, user_id, type, normalized_value, is_primary, verified_at)
		VALUES ($1, $2, 'email', lower($3), true, clock_timestamp())
	`, contactID, userID, email)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("insert contact: %w", err)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO identity.user_identities (id, user_id, provider, password_hash, status)
		VALUES ($1, $2, 'credentials', $3, 'active')
	`, identityID, userID, passwordHash)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("insert identity: %w", err)
	}

	return userID, true, nil
}
func (r *Repository) resend(ctx context.Context, email string, id uuid.UUID, hash string) (bool, error) {
	var ok bool
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_resend($1,$2,$3)`, email, id, hash).Scan(&ok)
	})
	return ok, err
}
func (r *Repository) verify(ctx context.Context, id uuid.UUID, hash string) (bool, error) {
	var ok bool
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_verify($1,$2)`, id, hash).Scan(&ok)
	})
	return ok, err
}

type credential struct {
	id   uuid.UUID
	hash string
}

func (r *Repository) credentials(ctx context.Context, email string) (credential, error) {
	var id uuid.UUID
	var hash string
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT user_id,password_hash FROM identity.auth_credentials($1)`, email).Scan(&id, &hash)
	})
	return credential{id, hash}, err
}
func (r *Repository) login(ctx context.Context, p Principal, password, refresh string, family uuid.UUID) (bool, error) {
	var ok bool
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_login($1,$2,$3,$4,$5)`, p.UserID, password, p.SessionID, family, digest(refresh)).Scan(&ok)
	})
	return ok, err
}

type refreshResult struct {
	principal Principal
	valid     bool
}

func (r *Repository) refresh(ctx context.Context, old, next string, id uuid.UUID) (refreshResult, error) {
	var result string
	var uid, sid sql.NullString
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT result,user_id,session_id FROM identity.auth_refresh($1,$2,$3)`, digest(old), id, digest(next)).Scan(&result, &uid, &sid)
	})
	if err != nil {
		return refreshResult{}, err
	}
	// An invalid/reused result is not a transaction error: the service must commit revocation.
	if result != "ok" || !uid.Valid || !sid.Valid {
		return refreshResult{}, nil
	}
	u, err := uuid.Parse(uid.String)
	if err != nil {
		return refreshResult{}, err
	}
	s, err := uuid.Parse(sid.String)
	if err != nil {
		return refreshResult{}, err
	}
	return refreshResult{principal: Principal{u, s}, valid: true}, nil
}
func (r *Repository) authorize(ctx context.Context, p Principal) (bool, error) {
	var ok bool
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_authorize($1,$2)`, p.UserID, p.SessionID).Scan(&ok)
	})
	return ok, err
}
func (r *Repository) logout(ctx context.Context, p Principal, all bool) error {
	var ok bool
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_logout($1,$2,$3)`, p.UserID, p.SessionID, all).Scan(&ok)
	})
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalid
	}
	return nil
}

type Profile struct {
	ID        uuid.UUID `json:"id"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Email     string    `json:"email"`
	Status    string    `json:"status"`
}

func (r *Repository) profile(ctx context.Context, p Principal) (Profile, error) {
	var out Profile
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		// Identity is global: no organization/store is invented or required.
		var value string
		if err := q.QueryRowContext(ctx, `SELECT set_config('app.user_id',$1,true)`, p.UserID.String()).Scan(&value); err != nil {
			return err
		}
		return q.QueryRowContext(ctx, `SELECT u.id,u.first_name,COALESCE(u.last_name,''),c.normalized_value,u.status FROM identity.users u JOIN identity.user_contacts c ON c.user_id=u.id WHERE u.id=$1 AND u.status='active' AND c.type='email' AND c.is_primary AND c.verified_at IS NOT NULL AND identity.auth_authorize($1,$2)`, p.UserID, p.SessionID).Scan(&out.ID, &out.FirstName, &out.LastName, &out.Email, &out.Status)
	})
	if err == sql.ErrNoRows {
		return Profile{}, ErrInvalid
	}
	return out, err
}

type idResult struct {
	id uuid.UUID
	ok bool
}

func (r *Repository) googleLogin(ctx context.Context, subject string, sessionID, familyID uuid.UUID, refresh string) (idResult, error) {
	var uid sql.NullString
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_google_login($1,$2,$3,$4)`, subject, sessionID, familyID, digest(refresh)).Scan(&uid)
	})
	if err != nil {
		return idResult{}, err
	}
	if !uid.Valid {
		return idResult{}, nil
	}
	u, err := uuid.Parse(uid.String)
	return idResult{id: u, ok: err == nil}, err
}

func (r *Repository) googleRegister(ctx context.Context, email, first, last, subject string, sessionID, familyID uuid.UUID, refresh string) (idResult, error) {
	var uid sql.NullString
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_google_register($1,$2,$3,$4,$5,$6,$7)`, email, first, last, subject, sessionID, familyID, digest(refresh)).Scan(&uid)
	})
	if err != nil {
		return idResult{}, err
	}
	if !uid.Valid {
		return idResult{}, nil
	}
	u, err := uuid.Parse(uid.String)
	return idResult{id: u, ok: err == nil}, err
}

func (r *Repository) googleLinkChallenge(ctx context.Context, email string, challengeID uuid.UUID, challengeHash string) (idResult, error) {
	var uid sql.NullString
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_google_link_challenge($1,$2,$3)`, email, challengeID, challengeHash).Scan(&uid)
	})
	if err != nil {
		return idResult{}, err
	}
	if !uid.Valid {
		return idResult{}, nil
	}
	u, err := uuid.Parse(uid.String)
	return idResult{id: u, ok: err == nil}, err
}

func (r *Repository) googleLinkConfirm(ctx context.Context, challengeID uuid.UUID, challengeHash string, userID uuid.UUID, subject string, sessionID, familyID uuid.UUID, refresh string) (bool, error) {
	var ok bool
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_google_link_confirm($1,$2,$3,$4,$5,$6,$7)`, challengeID, challengeHash, userID, subject, sessionID, familyID, digest(refresh)).Scan(&ok)
	})
	return ok, err
}

func (r *Repository) googleLinkWithPassword(ctx context.Context, userID uuid.UUID, subject string, sessionID, familyID uuid.UUID, refresh string) (bool, error) {
	var ok bool
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_google_link_with_password($1,$2,$3,$4,$5)`, userID, subject, sessionID, familyID, digest(refresh)).Scan(&ok)
	})
	return ok, err
}

func (r *Repository) userContacts(ctx context.Context, userID uuid.UUID) ([]ContactResponse, error) {
	var contacts []ContactResponse
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		var value string
		if err := q.QueryRowContext(ctx, `SELECT set_config('app.user_id',$1,true)`, userID.String()).Scan(&value); err != nil {
			return err
		}
		rows, err := q.QueryContext(ctx, `SELECT id, type, normalized_value, is_primary, verified_at IS NOT NULL, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') FROM identity.user_contacts WHERE user_id = $1 ORDER BY is_primary DESC, created_at ASC`, userID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var c ContactResponse
			if err := rows.Scan(&c.ID, &c.Type, &c.Value, &c.IsPrimary, &c.Verified, &c.CreatedAt); err != nil {
				return err
			}
			contacts = append(contacts, c)
		}
		return rows.Err()
	})
	return contacts, err
}

func (r *Repository) addContact(ctx context.Context, userID uuid.UUID, contactType, value string, challengeID uuid.UUID, challengeHash string) (idResult, error) {
	var cid sql.NullString
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_add_contact($1,$2,$3,$4,$5)`, userID, contactType, value, challengeID, challengeHash).Scan(&cid)
	})
	if err != nil {
		return idResult{}, err
	}
	if !cid.Valid {
		return idResult{}, nil
	}
	id, err := uuid.Parse(cid.String)
	return idResult{id: id, ok: err == nil}, err
}

func (r *Repository) verifyContact(ctx context.Context, challengeID uuid.UUID, challengeHash string) (bool, error) {
	var ok bool
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_verify_contact($1,$2)`, challengeID, challengeHash).Scan(&ok)
	})
	return ok, err
}

func (r *Repository) setPrimaryContact(ctx context.Context, userID, contactID uuid.UUID) (bool, error) {
	var ok bool
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_set_primary_contact($1,$2)`, userID, contactID).Scan(&ok)
	})
	return ok, err
}

func (r *Repository) deleteContact(ctx context.Context, userID, contactID uuid.UUID) (bool, error) {
	var ok bool
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		return q.QueryRowContext(ctx, `SELECT identity.auth_delete_contact($1,$2)`, userID, contactID).Scan(&ok)
	})
	return ok, err
}

func (r *Repository) userIdentities(ctx context.Context, userID uuid.UUID) ([]IdentityResponse, error) {
	var identities []IdentityResponse
	err := withExecutor(ctx, func(ctx context.Context, q database.DBTX) error {
		rows, err := q.QueryContext(ctx, `SELECT id, provider, status, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') FROM identity.auth_user_identities($1)`, userID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var i IdentityResponse
			if err := rows.Scan(&i.ID, &i.Provider, &i.Status, &i.CreatedAt); err != nil {
				return err
			}
			identities = append(identities, i)
		}
		return rows.Err()
	})
	return identities, err
}

// CheckRuntime rejects administrative credentials and missing RLS before serving traffic.
func CheckRuntime(ctx context.Context, db *sql.DB) error {
	var safe bool
	err := db.QueryRowContext(ctx, `SELECT current_user='eghissab_app'
 AND NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole AND NOT r.rolcreatedb
 AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member IN (current_user::regrole,'eghissab_identity_executor'::regrole))
 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='identity' AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR pg_has_role(current_user,c.relowner,'USAGE')))
 AND to_regprocedure('identity.auth_refresh(text,uuid,text)') IS NOT NULL
 FROM pg_roles r WHERE r.rolname=current_user`).Scan(&safe)
	if err != nil {
		return fmt.Errorf("cannot verify restricted identity runtime role and migration 000004: %w", err)
	}
	if !safe {
		return fmt.Errorf("restricted eghissab_app credentials and identity RLS migration 000004 are required")
	}
	return nil
}
