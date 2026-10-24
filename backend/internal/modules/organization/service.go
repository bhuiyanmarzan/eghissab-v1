package organization

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
	txm  database.TxManager
}

func NewService(repo *Repository, txm database.TxManager) *Service {
	return &Service{
		repo: repo,
		txm:  txm,
	}
}

var nonAlphanumericRegex = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = nonAlphanumericRegex.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

func generateSecureToken(bytesCount int) (string, error) {
	b := make([]byte, bytesCount)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *Service) Create(ctx context.Context, userID uuid.UUID, req CreateOrganizationRequest) (*OrganizationResponse, error) {
	slug := req.Slug
	if slug == "" {
		slug = slugify(req.Name)
		if len(slug) < 2 {
			slug = fmt.Sprintf("org-%s", uuid.New().String()[:8])
		}
	}

	var res *OrganizationResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.CreateOrganization(ctx, tx, req.Name, slug, userID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) Get(ctx context.Context, orgID, userID uuid.UUID) (*OrganizationResponse, error) {
	var res *OrganizationResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.GetOrganization(ctx, tx, orgID, userID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]OrganizationResponse, error) {
	var res []OrganizationResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.ListUserOrganizations(ctx, tx, userID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) Update(ctx context.Context, orgID, userID uuid.UUID, req UpdateOrganizationRequest) (*OrganizationResponse, error) {
	var res *OrganizationResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		mem, err := s.repo.GetMembership(ctx, tx, orgID, userID)
		if err != nil {
			return err
		}
		if !mem.IsOwner && mem.RoleCode != "admin" {
			return ErrForbidden
		}
		res, err = s.repo.UpdateOrganization(ctx, tx, orgID, req.Name)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListMembers(ctx context.Context, orgID, userID uuid.UUID) ([]MembershipResponse, error) {
	var res []MembershipResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		_, err := s.repo.GetMembership(ctx, tx, orgID, userID)
		if err != nil {
			return err
		}
		res, err = s.repo.ListMembers(ctx, tx, orgID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) InviteMember(ctx context.Context, orgID, userID uuid.UUID, req InviteMemberRequest) (*InvitationResponse, error) {
	rawToken, err := generateSecureToken(32)
	if err != nil {
		return nil, fmt.Errorf("generate invitation token: %w", err)
	}
	tokenHash := HashToken(rawToken)
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	var res *InvitationResponse
	err = s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		mem, err := s.repo.GetMembership(ctx, tx, orgID, userID)
		if err != nil {
			return err
		}
		if !mem.IsOwner && mem.RoleCode != "admin" {
			return ErrForbidden
		}

		res, err = s.repo.CreateInvitation(ctx, tx, orgID, req.Email, tokenHash, req.RoleCode, userID, expiresAt)
		return err
	})
	if err != nil {
		return nil, err
	}
	// Return the plaintext token in response so caller can deliver it
	res.Token = rawToken
	return res, nil
}

func (s *Service) AcceptInvitation(ctx context.Context, userID uuid.UUID, req AcceptInvitationRequest) (*OrganizationResponse, error) {
	tokenHash := HashToken(req.Token)
	var res *OrganizationResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.AcceptInvitation(ctx, tx, tokenHash, userID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) TransferOwnership(ctx context.Context, orgID, currentOwnerUserID uuid.UUID, req TransferOwnershipRequest) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		mem, err := s.repo.GetMembership(ctx, tx, orgID, currentOwnerUserID)
		if err != nil {
			return err
		}
		if !mem.IsOwner {
			return ErrForbidden
		}
		return s.repo.TransferOwnership(ctx, tx, orgID, currentOwnerUserID, req.NewOwnerUserID)
	})
}

func (s *Service) UpdateMemberRole(ctx context.Context, orgID, currentUserID, targetUserID uuid.UUID, req UpdateMemberRoleRequest) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		mem, err := s.repo.GetMembership(ctx, tx, orgID, currentUserID)
		if err != nil {
			return err
		}
		if !mem.IsOwner && mem.RoleCode != "admin" {
			return ErrForbidden
		}
		return s.repo.UpdateMemberRole(ctx, tx, orgID, targetUserID, req.RoleCode)
	})
}

func (s *Service) RemoveMember(ctx context.Context, orgID, currentUserID, targetUserID uuid.UUID) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		mem, err := s.repo.GetMembership(ctx, tx, orgID, currentUserID)
		if err != nil {
			return err
		}
		// Members can remove themselves (leave), or owners/admins can remove members
		if currentUserID != targetUserID && !mem.IsOwner && mem.RoleCode != "admin" {
			return ErrForbidden
		}
		return s.repo.RemoveMember(ctx, tx, orgID, targetUserID)
	})
}
