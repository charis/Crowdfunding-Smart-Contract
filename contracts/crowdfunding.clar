;; -------------------------------------------------------------------------- ;;
;;                             C O N S T A N T S                              ;;
;; -------------------------------------------------------------------------- ;;
;; - - - - - - ;;
;;   M I S C   ;;
;; - - - - - - ;;
;; `true` for testing or `false` for production
(define-constant TEST_MODE true)

;; The number of blocks that voting is allowed after a milestone is claimed by
;; the manager who created the campaign. Votes that are not timely casted are
;; essentially confidence votes.
(define-constant VOTE_DURATION u450) ;; Users have about 3 days to vote

;; - - - - - - - - - - - - - - - - - ;;
;;   C A M P A I G N   S T A T U S   ;;
;; - - - - - - - - - - - - - - - - - ;;
;; The campaign has not been created yet
(define-constant STATUS-PENDING   u0)
;; The crowdfunding goal is not met and the deadline has not passed
(define-constant STATUS-ACTIVE    u1)
;; The crowdfunding goal is met before the deadline
(define-constant STATUS-FUNDED    u2)
;; The crowdfunding goal is not met and the deadline passed
(define-constant STATUS-EXPIRED   u3)
;; The users are allowed to vote once a milestone is claimed
(define-constant STATUS-VOTE      u4)
;; A vote of no confidence is passed for this (funded) campaign
(define-constant STATUS-CANCELED  u5)
;; A vote of confidence is passed for every milestone of the funded campaign
;; and the owner claimed all milestones
(define-constant STATUS-COMPLETED u6)

;; - - - - - - - - - - - - - ;;
;;   E R R O R   C O D E S   ;;
;; - - - - - - - - - - - - - ;;
;; Indicates that we are supposed to run in test mode only
(define-constant ERR-NOT-TEST-MODE       (err u300))
;; Indicates that the tx-sender is not the owner
(define-constant ERR-NOT-OWNER           (err u400))
;; Indicates that the campaign is already created
(define-constant ERR-ALREADY-CREATED     (err u401))
;; Indicates that crowdfuncting goal cannot be zero
(define-constant ERR-ZERO-TARGET-GOAL    (err u402))
;; Indicates that campaign durarion cannot be zero
(define-constant ERR-ZERO-DURATION       (err u403))
;; Indicates that the number of campaign milestones cannot be zero
(define-constant ERR-ZERO-MILESTONES     (err u404))
;; Indicates that the donation amount cannot be zero
(define-constant ERR-ZERO-DONATION       (err u405))
;; Indicates that the campaign is not active (i.e., not STATUS-ACTIVE status)
(define-constant ERR-NOT-ACTIVE          (err u406))
;; Indicates that the tx-sender has not enough funds to complete the donation
(define-constant ERR-NOT-ENOUGH-FUNDS    (err u407))
;; Indicates that the STX transfer failed
(define-constant ERR-STX-TRANSFER        (err u408))
;; Indicates that the funds are frozen (either the campaign is active or funded
;; but a no confidence vote is not passed)
(define-constant ERR-FROZEN-FUNDS        (err u409))
;; Indicates that the tx-sender has not donated to the campaign or already
;; claimed the refund
(define-constant ERR-NO-REFUND           (err u410))
;; Indicates that the contract funds are not sufficient to refund the tx-sender
;; It should never be thrown but just in case...
(define-constant ERR-CONTRACT-BREACH     (err u411))
;; Indicates that the milestone index is out of bounds
(define-constant ERR-OUT-OF-BOUNDS       (err u412))
;; Indicates that the milestone is not found
(define-constant ERR-MILESTONE-NOT-FOUND (err u413))
;; Indicates that the milestone details are missing
(define-constant ERR-EMPTY-DETAILS       (err u414))
;; Indicates the campaign status is not the expected to complete the operation
(define-constant ERR-INVALID-STATUS      (err u415))
;; Indicates that user has not donated
(define-constant ERR-NO-DONATION         (err u416))
;; Indicates that the tx-sender has already votes
(define-constant ERR-ALREADY-VOTED       (err u417))
;; Indicates that vote is desabled for the milestone
(define-constant ERR-VOTE-DISABLED       (err u418))
;; Indicates that milestone is already claimed
(define-constant ERR-ALREADY-CLAIMED     (err u419))


;; -------------------------------------------------------------------------- ;;
;;                             D A T A    V A R S                             ;;
;; -------------------------------------------------------------------------- ;;
;; Lookup map where the key is the address of a contributor and the value is
;; the total donation amount in micro-STX by the given contributor
(define-map donations-map principal uint)

;; The campaign status
(define-data-var status uint STATUS-PENDING)

;; The owner (i.e., the address of the manager who created the campaign)
(define-data-var owner principal tx-sender)

;; The crowdfunding goal in micro-STX
(define-data-var funding-goal uint u0)

;; The total donated amount in micro-STX
(define-data-var total-donation-amount uint u0)

;; The block height that defines the deadline for reaching the crowdfunding goal
(define-data-var deadline-block-height uint u0)

;; The total refund amount
(define-data-var refund-total uint u0)

;; M I L E S T O N E S:
;; The total number of campaign milestones, which corresponds to the total
;; number of installments if a vote of no confidence is not passed.
(define-data-var num-of-milestones uint u0)
;; Number of remaining milestones to complete the campaign
(define-data-var remaining-milestones uint u0)

;; Stores the milestone information
;; It is a map where the key is the index of the milestone and the value is
;; a struct that contains
(define-map milestones uint {
    ;; Information about the milestone accomplishment (can be also a web URL) to
    ;; help the users decide what to vote
    info: (string-ascii 100),
    ;; The owner (project manager) sets this to true to allow users to vote
    ;; After the vote it is set back to false to disable future re-voting
    can-vote: bool, 
    ;; The total donation amount of the voters who vote to continue the campaign
    confidence-vote-total: uint,
    ;; The total donation amount of the voters who vote to cancel the campaign
    no-confidence-vote-total: uint, 
    ;; `true` if there is a majority vote to continue the campaign or
    ;; `false` if there is a majority vote to cancel the campaign
    approved: bool,
    ;; `true` if an approved milestone is claimed by the owner (project manager)
    claimed: bool
})
;; The installment amount for each milestone which is equal to the total
;; donation amount divided by the number of milestones
(define-data-var installment-amount uint u0)

;; V O T I N G:
;; Lookup map where the key is a tuple consisting of: 1) the voter's address,
;; and 2) the installment identifier for casting the vote. The value is a
;; boolean indicating whether the user has voted for the specified installment.
(define-map has-voted-map { user: principal, index: uint } bool)
;; The majority threashold for the votes which is equal to the 50% of the total
;; donation amount for funded campaigns.
;; The weighted vote is proportional to the donations. Thus the total donation
;; amount represents the 100% of the votes.
(define-data-var majority-threshold uint u0)
;; The sum of donations of the donors who voted to continue the campaign
(define-data-var confidence-total uint u0)
;; The sum of donations of the donors who voted to cancel the campaign
(define-data-var no-confidence-total uint u0)
;; The block height that defines the deadline to vote
(define-data-var vote-end-block-height uint u0)


;; -------------------------------------------------------------------------- ;;
;;                      P U B L I C    F U N C T I O N S                      ;;
;; -------------------------------------------------------------------------- ;;

;; Creates and activates a new campaign. It is essentially the initalization
;; function which is the first one to call.
;;       
;; @param uint target-goal The crowdfunding goal in micro-STX
;; @param uint duration The number of blocks till the deadline to reach the
;;                      crowdfunding goal
;; @param uint num-milestones The total number of the campaign milestones
;;
;; @return an (ok true) response if this is the first time this function is
;;         called and the target goal, the duration and numboer of milestones
;;         are positve (i.e., non-zero) numbers or an error otherwise
(define-public (create-campaign (target-goal    uint)
                                (duration       uint)
                                (num-milestones uint))
    (begin
        ;; Parameter validation
        ;; Check also if the contract is already initialized
        (asserts! (is-eq (var-get owner) tx-sender) ERR-NOT-OWNER)
        (asserts! (is-eq (var-get status) STATUS-PENDING) ERR-ALREADY-CREATED)
        (asserts! (> target-goal u0) ERR-ZERO-TARGET-GOAL)
        (asserts! (> duration u0) ERR-ZERO-DURATION)
        (asserts! (> num-milestones u0) ERR-ZERO-MILESTONES)

        ;; Block any subsequent create-campaign() calls and store the passed
        ;; parameter values
        (var-set status STATUS-ACTIVE)
        (var-set funding-goal target-goal)
        (var-set deadline-block-height (+ block-height duration))
        (var-set num-of-milestones num-milestones)
        (var-set remaining-milestones num-milestones)
        (ok true)
    )
)

;; Donates the specified amount in micro-STX to the campaign
;;
;; @return an (ok `amount`) response where amount is passed argument value if
;;         the function call succeeds or an error otherwise
(define-public (donate (amount uint))
    (begin
        ;; Check if the deadline passed (if so, update status to STATUS-EXPIRED)
        (unwrap-panic (check-deadline))
        ;; Donations are allowed only if the status is STATUS-ACTIVE
        (asserts! (is-eq (var-get status) STATUS-ACTIVE) ERR-NOT-ACTIVE)
        ;; A donation of 0 is meaningless
        (asserts! (> amount u0) ERR-ZERO-DONATION)

        ;; Check if the sender has sufficient funds
        (asserts! (> (stx-get-balance tx-sender) amount) ERR-NOT-ENOUGH-FUNDS)

        ;; Perform the STX transfer
        ;; (as-contract tx-sender) -> transform `tx-sender` into the contract's
        ;;                            principal, effectively making the contract
        ;;                            itself the recipient of the STX transfer.
        (let
            ((stx-transfer-result
                      (stx-transfer? amount tx-sender (as-contract tx-sender))))
            (unwrap! stx-transfer-result ERR-STX-TRANSFER)
        )

        ;; Only now that the transfer completed can we update the donations-map
        ;; and the refund-map
        (let ((total-so-far (default-to u0 (map-get? donations-map tx-sender))))
             ;; Add the new donation amount to the existing total (if any)
             (let ((new-total (+ total-so-far amount)))
                (map-set donations-map tx-sender new-total)
             )
        )
        ;; Check if the crowfdunfing goal is met and so, change the status to
        ;; STATUS-FUNDED
        (let ((donations-sum (stx-get-balance (as-contract tx-sender))))
            (if (>= donations-sum (var-get funding-goal))
                (begin
                    (var-set total-donation-amount donations-sum)
                    (var-set majority-threshold (/ donations-sum u2))
                    (var-set status STATUS-FUNDED) 
                    (var-set installment-amount
                             (/ donations-sum (var-get num-of-milestones)))
                    (ok amount)
                )
                (ok amount) ;; No status change if funding goal is not reached
            )
        )
    )
)

;; Called by the owner (i.e., project manager) to post a milestone.
;; The owner provides a short description about the accomplishment (or a web URL
;; to a page with the milestone details) which opens the voting window for the
;; users to cast their votes.
;; 
;; @param string-ascii details Information about the milestone accomplishment
;;                             (can be a web URL) to help the users decide what
;;                             to vote
;; @param uint index The milestone index
;;
;; @return an (ok true) response if successful or an Err response otherwise
(define-public (post-milestone (details (string-ascii 100))
                               (index   uint))
    (begin 
        ;; Validate that the campaign status is STATUS-FUNDED
        (asserts! (is-eq (var-get status) STATUS-FUNDED) ERR-INVALID-STATUS)
        ;; Validate the milestone index
        (asserts! (<= index (var-get num-of-milestones)) ERR-OUT-OF-BOUNDS)
        ;; Only the project manager can post a milestone
        (asserts! (is-eq tx-sender (var-get owner)) ERR-NOT-OWNER)
        ;; Prevent empty text
        (asserts! (> (len details) u0) ERR-EMPTY-DETAILS)
        (map-insert milestones 
                    index 
                    { info: details,
                      can-vote: true,
                      confidence-vote-total: u0,
                      no-confidence-vote-total: u0,
                      approved: true, ;;Will set to false for no-confidence vote
                      claimed: false,
                    } 
        ) 
        ;; Change the campaign status to STATUS-VOTE to allow users to vote
        (var-set status STATUS-VOTE)
        ;; Give the voters 450 blocks (about 3 days) to vote
        (var-set vote-end-block-height (+ block-height VOTE_DURATION))
        (ok true)
    )
)

;; Cast the user's vote for the specified milestone.
;; To vote the project manager must have posted that milestone and voting should
;; be enabled (i.e., the `can-vote` field is `true` and the campaign status is
;; STATUS_VOTE).
;; The user must have donated to the campaign and is not allowed to vote more
;; than once for the same milestone.
;; - If the user's vote results in a majority vote of confidence, the vote
;;   closes immediately and the campaign status is set to STATUS_FUNDED (i.e.,
;;   the campaign continues). Only then can the owner claim the milestone funds.
;; - If the user's vote results in a majority vote of no confidence, the vote
;;   closes immediately and the campaign status is set to STATUS_CANCELED (i.e.,
;;   the campaign is canceled). Only then can the user claim the proportional
;;   leftover funds for the funded campaign.
;;
;; @param uint index The index of the milestone to vote for
;; @param bool value `true` means vote of confidence while `false` means vote of
;;                    no confidence
;;
;; @return an (ok true) response if successful or an Err response otherwise
(define-public (vote (index uint)
                     (value bool))
    (begin
        ;; Check if the deadline to vote passed. Iff so, update status to
        ;; STATUS-FUNDED, as if there was a majority vote before the deadline
        ;; voting would end. This means that a no confidence vote did not pass
        ;; before the deadline and therefore the campaign can continue.
        (unwrap-panic (check-vote-deadline))
        ;; Voting is allowed only if the status is STATUS-VOTE
        (asserts! (is-eq (var-get status) STATUS-VOTE) ERR-INVALID-STATUS)
        

        ;; Validate the milestone index
        (asserts! (<= index (var-get num-of-milestones)) ERR-OUT-OF-BOUNDS)
        ;; Validate that the user has donated
        (unwrap! (map-get? donations-map tx-sender) ERR-NO-DONATION)

        ;; Verify that the user has not already voted for the specified
        ;; milestone
        (asserts! (default-to true
                   (map-get? has-voted-map {user:  tx-sender,
                                            index: index}))
                   ERR-ALREADY-VOTED)

        ;; Get the milestone for the given index
        (let ((milestone (unwrap! (map-get? milestones index)
                          ERR-MILESTONE-NOT-FOUND)))
            ;; Validate that voting is enabled for the given milestone
            (asserts! (get can-vote milestone) ERR-VOTE-DISABLED)

            ;; Now we know that the user is eligible to vote and is voting for
            ;; the correct milestone. Prevent double-voting
            (map-insert has-voted-map {user: tx-sender, index: index} value)

            ;; The vote-weight is the same as the donated amount by the user
            ;; It is not a percentags or if you will, 100% weight is the sum of 
            ;; all the donations
            (let
                ((vote-weight (unwrap-panic (map-get? donations-map tx-sender))))
                (if value
                    ;; The user gave a confidence vote
                    ;; Increment the confidence-vote-total and check if the milestone is approved
                    (let ((total (+ (get confidence-vote-total milestone) vote-weight)))
                        (let ((approved (> total (var-get majority-threshold))))
                            (map-set milestones index (merge milestone { confidence-vote-total: total, 
                                                                         can-vote: (not approved) }))
                            (if approved
                                ;; The campaign is not cancelel
                                (ok (var-set status STATUS-FUNDED))
                                (ok true)
                            )
                        )
                    )

                    ;; The user gave a no-confidence vote
                    ;; Increment the no-confidence-vote-total and check if the campaign is canceled
                    (let ((total (+ (get no-confidence-vote-total milestone) vote-weight)))
                        (let ((rejected (> total (var-get majority-threshold))))
                            (if rejected
                                (begin 
                                    (map-set milestones index (merge milestone { confidence-vote-total: total, 
                                                                                 can-vote: false,
                                                                                 approved: false }))
                                    (ok (var-set status STATUS-CANCELED))
                                )
                                (ok (map-set milestones index (merge milestone { confidence-vote-total: total, 
                                                                                 can-vote: true })))
                            )
                        )
                    )
                )   
            )
        )
    )
)

;; The owner claims the funds for the specified milestone provided that the
;; following requirements are met:
;;    1) The campaign status is STATUS_FUNDED which means the users are not
;;       still voting
;;    2) The users approved the campaign for the specified milestone (i.e.,
;;       the `approved` field is `true`).
;; The installment amount is equal to the overall donation amount divided by
;; the number of milestones and is takes proportionally from the donors.
;;
;; @param uint index The index of the milestone to claim the funds for
;;
;; @return an (ok `) response if successful or an Err response otherwise
;; @return an (ok `amount`) response where if the function call succeeds or an
;;         error in case of violation one of the conditions to claim the
;;         milestone or in case of an unexpected error during the STX refund
;;         transaction
(define-public (claim-milestone-funds (index uint)) 
    (begin
        ;; Validate that the campaign status is STATUS-FUNDED
        (asserts! (is-eq (var-get status) STATUS-FUNDED) ERR-INVALID-STATUS)
        ;; Validate the milestone index
        (asserts! (<= index (var-get num-of-milestones)) ERR-OUT-OF-BOUNDS)
        ;; Only the project manager can claim the milestone funds
        (asserts! (is-eq tx-sender (var-get owner)) ERR-NOT-OWNER)
        ;; Validate that the milestone is posted
        (let ((milestone (unwrap! (map-get? milestones index)
               ERR-MILESTONE-NOT-FOUND)))
            ;; Validate that the milestone is not already claimed
            (asserts! (not (get claimed milestone)) ERR-ALREADY-CLAIMED)
                ;; Sanity check: Make sure the contract has sufficient funds
                ;;               to refund the owner which should always
                ;;               happen unless the contract is hacked.
                (asserts! (>= (stx-get-balance (as-contract tx-sender))
                              (var-get installment-amount)) ERR-CONTRACT-BREACH)

                ;; Transfer the funds from the contract to the owner
                (let ((stx-transfer-result (as-contract (stx-transfer?
                      (var-get installment-amount) tx-sender (var-get owner)))))
                    (unwrap! stx-transfer-result ERR-STX-TRANSFER)
                    ;; Now that the transfer completed can we update the
                    ;; milestone to set the `claimed` field to `true`
                    (map-set milestones index (merge milestone {claimed: true}))

                    ;; Decrement the number of remaining milestones
                    (var-set remaining-milestones
                             (- (var-get remaining-milestones) u1))
                    
                    (if (is-eq (var-get remaining-milestones) u0)
                        (begin 
                             ;; There are no milestones left
                             ;; Set the campaign status to COMPLETED
                             (var-set status STATUS-COMPLETED)
                             ;; Return the installment amount
                             (ok (var-get installment-amount))
                        )
                        ;; Return the installment amount
                        (ok (var-get installment-amount))
                    )
                )
        )
    )
)

;; Refunds the `tx-sender` in any of the following two cases:
;; Case 1: The campaign did not reach the crowdfunding goal and the deadline
;;         expired. In this case, the `tx-sender` receives back the full donated
;;         amount.
;; Case 2: The campaign was funded but got cancelled later bacause a vote of
;;         no confidence was passed. In thie case, the `tx-sender` receives the
;;         a proportional refund from the leftover funds.
;;
;; @return an (ok `refunded amount`) response where if the function call
;;         succeeds or an error (e.g., if the campaign status does not fall
;;         under any of the two cases above or the `tx-sender` has not donated
;;         or in case of an unexpected error during the STX refund transaction
(define-public (claim-refund)
    (begin
        ;; Make sure thatthe status is either STATUS-CANCELED or STATUS-EXPIRED
        (asserts! (or (is-eq (var-get status) STATUS-CANCELED) 
                      (is-eq (var-get status) STATUS-EXPIRED)) ERR-FROZEN-FUNDS)
        ;; Make sure that the tx-sender desrves a refund
        ;; (let (refund-recipient tx-sender)
        (let ((amount (unwrap! (map-get? donations-map tx-sender) ERR-NO-REFUND)))
             (let ((adjusted-amount (unwrap-panic (adjust-refund-amount amount))))
                (let ((recipient tx-sender))
                    ;; Sanity check: Make sure the contract has sufficient funds
                    ;;               to refund the tx-sender which should always
                    ;;               happen unless the contract is hacked.
                    (asserts! (>= (stx-get-balance (as-contract tx-sender))
                                   adjusted-amount) ERR-CONTRACT-BREACH)

                    ;; Transfer the funds from the contract to the tx-sender
                    (let ((stx-transfer-result (as-contract 
                          (stx-transfer? adjusted-amount tx-sender recipient))))
                        (unwrap! stx-transfer-result ERR-STX-TRANSFER) 
                    )

                    ;; Now that the transfer completed can we update the map
                    (map-delete donations-map tx-sender)
                    (ok amount)
                )
            )
        )
    )
)

;; Checks the campaign status and if it is other than STATUS-ACTIVE is does
;; nothing. Otherwise, it checks if the campaign deadline has passed and if so
;; it sets the status to STATUS-EXPIRED.
;;
;; @return an (ok `status`) response where `status` is the campaign status
(define-public (check-deadline)
    (begin
        (if (and (is-eq (var-get status) STATUS-ACTIVE)
                 (>= block-height (var-get deadline-block-height)))
            (begin
                (var-set status STATUS-EXPIRED)
                (ok STATUS-EXPIRED)
            )
            (ok (var-get status))
        )
    )
)

;; Checks the campaign status and if it is other than STATUS-VOTE is does
;; nothing. Otherwise, it checks if the vote deadline has passed and if so
;; it sets the status to STATUS-FUNDED.
;;
;; @return an (ok `status`) response where `status` is the campaign status
(define-public (check-vote-deadline)
    (begin
        (if (and (is-eq (var-get status) STATUS-VOTE)
                 (>= block-height (var-get vote-end-block-height)))
            (begin
                (var-set status STATUS-FUNDED)
                (ok STATUS-FUNDED)
            )
            (ok (var-get status))
        )
    )
)

;; -------------------------------------------------------------------------- ;;
;;                   R E A D - O N L Y    F U N C T I O N S                   ;;
;; -------------------------------------------------------------------------- ;;
;; @return the campaign status
(define-read-only (get-status) 
    (var-get status)
)

;; @return the crowdfunding goal in micro-STX
(define-read-only (get-funding-goal) 
    (var-get funding-goal)
)

;; @return the block height that defines the deadline for reaching the
;;         crowdfunding goal
(define-read-only (get-deadline-block-height) 
    (var-get deadline-block-height)
)

;; @return the block height that defines the voting deadline
(define-read-only (get-vote-end-block-height) 
    (var-get vote-end-block-height)
)

;; @return the total number of campaign milestones
(define-read-only (get-num-of-milestones) 
    (var-get num-of-milestones)
)

;; Returns the total donation amount in micro-STX for a given contributor
;; address
;;
;; @param principal address The contributor address to retrieve the total
;;                          donation amount
;; 
;; @return the total donation amount by the given address or 0 if there is no
;;         donation amount by the given contributor address
(define-read-only (get-donation-amount (address principal)) 
    (default-to u0 (map-get? donations-map address))
)

;; Given a milestone index it returns the details for the specified milestone
;; assuming that it has been posted.
;;
;; @param uint index The milestone index
;;
;; @return an (ok `details`) response where `details` is the milestone details
;;         text or an error if the index is out of bounds or there is no posted
;;         posted milestone for the specified index
(define-read-only (get-milestone (index uint))
    (begin
        ;; Validate the milestone index
        (asserts! (<= index (var-get num-of-milestones)) ERR-OUT-OF-BOUNDS)
        (let ((milestone (map-get? milestones index)))
            ;; Ensure the milestone exists
            (asserts! (is-some milestone) ERR-MILESTONE-NOT-FOUND)
            ;; Extract and return the info field from the milestone
            (ok (get info milestone))
        )
    )
)

;; Given a milestone index it returns the details for the specified milestone
;; assuming that it has been posted.
;; The owner provides a short description about the accomplishment (or a web URL
;; to a page with the milestone details) which opens the voting window for the
;; users to cast their votes.
;; 
;; @param string-ascii details Information about the milestone accomplishment
;;                             (can be also a web URL) to help the users decide
;;                             what to vote

;; @return the (unlocked) STX balance of the contract, in micro-STX
(define-read-only (get-balance)
    (stx-get-balance (as-contract tx-sender))
)

;; @return the total donation amount in micro-STX
(define-read-only (get-total-donation-amoun)
    (var-get total-donation-amount)
)

;; -------------------------------------------------------------------------- ;;
;;                     P R I V A T E    F U N C T I O N S                     ;;
;; -------------------------------------------------------------------------- ;;

;; Used only for testing purposes to set the deadline-block-height
;;
;; @param uint value The value to set the deadline-block-height to
;;
;; @return an (ok true) response if in test mode or an Err response otherwise
(define-private (set-deadline-block-height (value uint))
    (begin
        (asserts! (is-eq TEST_MODE true) ERR-NOT-TEST-MODE)
        (var-set deadline-block-height value)
        (ok true)
    )
)

;; Adjusts the refund amount taking into account the leftover funds and the
;; user's donated amount.
;;
;; @param uint donation-amount The user's donation amount
;;
;; @return an (ok `adjusted amount`) where `adjusted amount` is the same as the
;;         donation amount if the campaign is not funded and the leftover 
;;         proportional amount (in respect to the total donations) if the
;;         if the campaigns reached the crowdfunding goal.
(define-private (adjust-refund-amount (donation-amount uint))
    (if (is-eq (var-get status) STATUS-EXPIRED)
        (ok donation-amount)
        (begin
            (if (is-eq (var-get refund-total) u0)
                (begin 
                    (var-set refund-total (stx-get-balance (as-contract tx-sender)))
                    (ok (/ (* donation-amount (stx-get-balance (as-contract tx-sender)))
                           (var-get total-donation-amount)
                        )
                    )
                )
                (ok (/ (* donation-amount (var-get refund-total))
                       (var-get total-donation-amount)
                    )
                )                
            )
        )
    )
)

;; Used only for testing purposes to set the campaign status
;;
;; @param uint value The value to set the status to
;;
;; @return an (ok true) if in test mode or an Err response otherwise
(define-private (set-status (value uint))
    (begin
        (asserts! (is-eq TEST_MODE true) ERR-NOT-TEST-MODE)
        (var-set status value)
        (ok true)
    )
)

;; -------------------------------------------------------------------------- ;;
;;                       D E B U G G I N G     T R I C K                      ;;
;; -------------------------------------------------------------------------- ;;
;; DEBUG ONLY - COMMENT ME OUT AT THE END
;; Trick: Change the type of DEBUG-DATA to the value that you want to check
;;        Then call:
;;                      (var-set DEBUG-DATA <what you need to retrieve>)
;; (define-data-var DEBUG-INFO uint u0)
;; (define-read-only (get-DEBUG-INFO)
;;     (var-get DEBUG-INFO)
;; )
