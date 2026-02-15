package handlers

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func jsonResponse(status int, body string, headers map[string]string) *http.Response {
	h := make(http.Header)
	for k, v := range headers {
		h.Set(k, v)
	}
	if h.Get("Content-Type") == "" {
		h.Set("Content-Type", "application/json")
	}
	return &http.Response{
		StatusCode: status,
		Header:     h,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func TestFetchGitHubOpenCounts_UsesSearchCountsWhenAvailable(t *testing.T) {
	client := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.Path {
			case "/search/issues":
				query := req.URL.Query().Get("q")
				if strings.Contains(query, "is:issue") {
					return jsonResponse(http.StatusOK, `{"total_count":20}`, nil), nil
				}
				if strings.Contains(query, "is:pr") {
					return jsonResponse(http.StatusOK, `{"total_count":38}`, nil), nil
				}
			case "/repos/owner/repo/branches":
				return jsonResponse(http.StatusOK, `[]`, map[string]string{
					"Link": `<https://api.github.com/repositories/1/branches?per_page=1&page=6>; rel="last"`,
				}), nil
			case "/repos/owner/repo/discussions":
				return jsonResponse(http.StatusOK, `[]`, map[string]string{
					"Link": `<https://api.github.com/repositories/1/discussions?per_page=1&page=4>; rel="last"`,
				}), nil
			}
			t.Fatalf("unexpected request path: %s", req.URL.Path)
			return nil, nil
		}),
	}

	counts, err := fetchGitHubOpenCounts(context.Background(), client, "owner/repo", "")
	if err != nil {
		t.Fatalf("fetchGitHubOpenCounts returned error: %v", err)
	}
	if counts.issues != 20 || counts.prs != 38 || counts.branches != 6 || counts.discussions != 4 {
		t.Fatalf("unexpected counts: %+v", counts)
	}
	if !counts.issuesKnown || !counts.prsKnown || !counts.branchesKnown || !counts.discussionsKnown {
		t.Fatalf("expected all counts to be known, got %+v", counts)
	}
}

func TestFetchGitHubOpenCounts_FallsBackWhenSearchFails(t *testing.T) {
	client := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.Path {
			case "/search/issues":
				return jsonResponse(http.StatusForbidden, `{"message":"secondary rate limit"}`, nil), nil
			case "/repos/owner/repo":
				return jsonResponse(http.StatusOK, `{"open_issues_count":58}`, nil), nil
			case "/repos/owner/repo/pulls":
				return jsonResponse(http.StatusOK, `[]`, map[string]string{
					"Link": `<https://api.github.com/repositories/1/pulls?per_page=1&page=38>; rel="last"`,
				}), nil
			case "/repos/owner/repo/branches":
				return jsonResponse(http.StatusOK, `[]`, map[string]string{
					"Link": `<https://api.github.com/repositories/1/branches?per_page=1&page=9>; rel="last"`,
				}), nil
			case "/repos/owner/repo/discussions":
				return jsonResponse(http.StatusNotFound, `{"message":"not found"}`, nil), nil
			}
			t.Fatalf("unexpected request path: %s", req.URL.Path)
			return nil, nil
		}),
	}

	counts, err := fetchGitHubOpenCounts(context.Background(), client, "owner/repo", "")
	if err != nil {
		t.Fatalf("fetchGitHubOpenCounts returned error: %v", err)
	}
	if counts.issues != 20 || counts.prs != 38 || counts.branches != 9 || counts.discussions != 0 {
		t.Fatalf("unexpected fallback counts: %+v", counts)
	}
	if !counts.issuesKnown || !counts.prsKnown || !counts.branchesKnown || !counts.discussionsKnown {
		t.Fatalf("expected fallback counts to be marked known, got %+v", counts)
	}
}

func TestFetchGitHubOpenCounts_MarksUnknownCollectionsWhenCollectionEndpointsFail(t *testing.T) {
	client := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.Path {
			case "/search/issues":
				query := req.URL.Query().Get("q")
				if strings.Contains(query, "is:issue") {
					return jsonResponse(http.StatusOK, `{"total_count":12}`, nil), nil
				}
				if strings.Contains(query, "is:pr") {
					return jsonResponse(http.StatusOK, `{"total_count":5}`, nil), nil
				}
			case "/repos/owner/repo/branches":
				return jsonResponse(http.StatusForbidden, `{"message":"forbidden"}`, nil), nil
			case "/repos/owner/repo/discussions":
				return jsonResponse(http.StatusForbidden, `{"message":"forbidden"}`, nil), nil
			}
			t.Fatalf("unexpected request path: %s", req.URL.Path)
			return nil, nil
		}),
	}

	counts, err := fetchGitHubOpenCounts(context.Background(), client, "owner/repo", "")
	if err != nil {
		t.Fatalf("fetchGitHubOpenCounts returned error: %v", err)
	}
	if counts.issues != 12 || counts.prs != 5 {
		t.Fatalf("unexpected issue/pr counts: %+v", counts)
	}
	if counts.branches != 0 || counts.discussions != 0 {
		t.Fatalf("expected unavailable collection counts to default to 0, got %+v", counts)
	}
	if !counts.issuesKnown || !counts.prsKnown {
		t.Fatalf("expected search counts to be known, got %+v", counts)
	}
	if counts.branchesKnown || counts.discussionsKnown {
		t.Fatalf("expected failed collection counts to be unknown, got %+v", counts)
	}
}
