package records

import (
	"time"

	"github.com/google/uuid"
)

// CreateRecordRequest is the body for POST /api/entities/{entityId}/records.
type CreateRecordRequest struct {
	Data map[string]interface{} `json:"data"`
}

// UpdateRecordRequest is the body for PATCH /api/entities/{entityId}/records/{recordId}.
type UpdateRecordRequest struct {
	Data    map[string]interface{} `json:"data"`
	Version int                    `json:"version"`
}

// RecordResponse is the API representation of a single record.
type RecordResponse struct {
	RecordID   uuid.UUID              `json:"recordId"`
	EntityID   uuid.UUID              `json:"entityId"`
	TenantID   uuid.UUID              `json:"tenantId"`
	Data       map[string]interface{} `json:"data"`
	Version    int                    `json:"version"`
	CreatedOn  time.Time              `json:"createdOn"`
	CreatedBy  *uuid.UUID             `json:"createdBy,omitempty"`
	ModifiedOn time.Time              `json:"modifiedOn"`
	ModifiedBy *uuid.UUID             `json:"modifiedBy,omitempty"`
}

// ListRecordsResponse is returned by GET /api/entities/{entityId}/records.
type ListRecordsResponse struct {
	Items      []RecordResponse `json:"items"`
	TotalCount int64            `json:"totalCount"`
}

func toRecordResponse(r *EntityRecord) RecordResponse {
	if r == nil {
		return RecordResponse{}
	}
	data := r.Data
	if data == nil {
		data = map[string]interface{}{}
	}
	return RecordResponse{
		RecordID:   r.ID,
		EntityID:   r.EntityID,
		TenantID:   r.TenantID,
		Data:       data,
		Version:    r.Version,
		CreatedOn:  r.CreatedOn,
		CreatedBy:  r.CreatedBy,
		ModifiedOn: r.ModifiedOn,
		ModifiedBy: r.ModifiedBy,
	}
}
