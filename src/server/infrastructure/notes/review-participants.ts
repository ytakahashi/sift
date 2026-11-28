import { ReviewConflict, type ReviewRole } from '../../../domain/notes/review-session';
import type { RepositoryId } from '../../../domain/repository/repository';

interface Assignment {
  reviewId: string;
  role: ReviewRole;
}

interface Connection {
  assignment?: Assignment;
}

interface ReviewRoleHistory {
  reviewId: string;
  roles: Map<string, ReviewRole>;
}

export class ReviewParticipants {
  private readonly connections = new Map<RepositoryId, Map<string, Connection>>();
  private readonly roleHistory = new Map<RepositoryId, ReviewRoleHistory>();

  connect(repoId: RepositoryId, participantId: string): () => string | undefined {
    const connections = this.connections.get(repoId) ?? new Map<string, Connection>();
    if (connections.has(participantId)) {
      throw new ReviewConflict('This review participant already has an open connection.');
    }
    const connection: Connection = {};
    this.connections.set(repoId, connections);
    connections.set(participantId, connection);

    return () => {
      // A repeated cleanup must not remove a newer connection with the same ID.
      if (connections.get(participantId) !== connection) {
        return undefined;
      }
      connections.delete(participantId);
      if (connections.size === 0) {
        this.connections.delete(repoId);
      }
      return connection.assignment?.reviewId;
    };
  }

  getObservedReview(
    repoId: RepositoryId,
    participantId: string,
    role: ReviewRole,
  ): string | undefined {
    const assignment = this.getConnection(repoId, participantId).assignment;
    return assignment?.role === role ? assignment.reviewId : undefined;
  }

  claim(repoId: RepositoryId, participantId: string, reviewId: string, role: ReviewRole): void {
    const connection = this.getConnection(repoId, participantId);
    const history = this.roleHistory.get(repoId);
    const roles = history?.reviewId === reviewId ? history.roles : new Map<string, ReviewRole>();

    // A disconnected participant in a paused review frees its role for another process,
    // but the same process must keep its original role if it reconnects for that review.
    const previous = roles.get(participantId);
    if (previous !== undefined && previous !== role) {
      throw new ReviewConflict('One MCP process cannot take both roles in the same review.');
    }
    for (const peer of this.connections.get(repoId)?.values() ?? []) {
      if (
        peer !== connection &&
        peer.assignment?.reviewId === reviewId &&
        peer.assignment.role === role
      ) {
        throw new ReviewConflict('Another MCP process already holds this role in the review.');
      }
    }
    roles.set(participantId, role);
    this.roleHistory.set(repoId, { reviewId, roles });
    connection.assignment = { reviewId, role };
  }

  private getConnection(repoId: RepositoryId, participantId: string): Connection {
    const connection = this.connections.get(repoId)?.get(participantId);
    if (!connection) {
      throw new ReviewConflict('The review participant connection closed. Reconnect and retry.');
    }
    return connection;
  }
}
