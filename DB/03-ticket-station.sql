-- A ticket is for the kitchen (1) or the bar (2). Tickets that exist already only hold food,
-- so they become kitchen tickets. Safe to run more than once. Undo: 03-ticket-station-down.sql.
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('Ticket', 'Station') IS NULL
BEGIN
    ALTER TABLE Ticket ADD Station tinyint NOT NULL
        CONSTRAINT DF_Ticket_Station DEFAULT 1
        CONSTRAINT CK_Ticket_Station CHECK (Station IN (1, 2));
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Ticket_OpenPerStation')
BEGIN
    CREATE INDEX IX_Ticket_OpenPerStation ON Ticket(Station, CreatedAt) WHERE DoneAt IS NULL;
END
GO
