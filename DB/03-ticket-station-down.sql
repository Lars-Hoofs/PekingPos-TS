-- Undoes 03-ticket-station.sql. Bar tickets cannot exist without the column, so they are refused:
-- mark them as done or remove them first. Safe to run more than once.
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('Ticket', 'Station') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM Ticket WHERE Station = 2)
        THROW 50000, 'There are bar tickets. Undoing would turn them into kitchen tickets; nothing was changed.', 1;

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Ticket_OpenPerStation')
        DROP INDEX IX_Ticket_OpenPerStation ON Ticket;
    ALTER TABLE Ticket DROP CONSTRAINT CK_Ticket_Station;
    ALTER TABLE Ticket DROP CONSTRAINT DF_Ticket_Station;
    ALTER TABLE Ticket DROP COLUMN Station;
END
GO
