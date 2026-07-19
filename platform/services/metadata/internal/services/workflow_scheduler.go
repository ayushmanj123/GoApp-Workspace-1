package services

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
)

// WorkflowScheduler polls for due schedule triggers and runs them synchronously.
type WorkflowScheduler struct {
	store    repositories.Store
	svc      *WorkflowService
	interval time.Duration
	limit    int
	logger   *slog.Logger

	mu     sync.Mutex
	stopCh chan struct{}
	doneCh chan struct{}
}

func NewWorkflowScheduler(store repositories.Store, svc *WorkflowService, logger *slog.Logger) *WorkflowScheduler {
	if logger == nil {
		logger = slog.Default()
	}
	return &WorkflowScheduler{
		store:    store,
		svc:      svc,
		interval: 30 * time.Second,
		limit:    20,
		logger:   logger,
	}
}

// Start begins the poll loop in a background goroutine.
func (s *WorkflowScheduler) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.stopCh != nil {
		return
	}
	s.stopCh = make(chan struct{})
	s.doneCh = make(chan struct{})
	go s.loop()
}

// Stop signals the poller to exit and waits for it.
func (s *WorkflowScheduler) Stop() {
	s.mu.Lock()
	stopCh := s.stopCh
	doneCh := s.doneCh
	s.mu.Unlock()
	if stopCh == nil {
		return
	}
	close(stopCh)
	<-doneCh
	s.mu.Lock()
	s.stopCh = nil
	s.doneCh = nil
	s.mu.Unlock()
}

func (s *WorkflowScheduler) loop() {
	defer close(s.doneCh)
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()
	s.tick()
	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.tick()
		}
	}
}

func (s *WorkflowScheduler) tick() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	claimed, err := s.store.ClaimDueScheduledWorkflows(ctx, time.Now().UTC(), s.limit)
	if err != nil {
		s.logger.Error("workflow scheduler claim failed", "error", err.Error())
		return
	}
	for _, wf := range claimed {
		_, runErr := s.svc.Run(ctx, wf.TenantID, wf.ID, WorkflowRunOptions{
			TriggerSource: TriggerSchedule,
			UserID:        uuid.Nil,
		})
		if runErr != nil {
			s.logger.Error("workflow schedule run failed",
				"workflow_id", wf.ID.String(),
				"tenant_id", wf.TenantID.String(),
				"error", runErr.Error(),
			)
		}
	}
}
