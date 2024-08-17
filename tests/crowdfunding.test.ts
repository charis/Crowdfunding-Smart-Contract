
import { describe, expect, it } from "vitest";
import { boolCV,
         ClarityType,
         principalCV,
         ResponseErrorCV,
         ResponseOkCV,
         SomeCV,
         StringAsciiCV,
         stringAsciiCV,
         UIntCV,
         uintCV,
       } from "@stacks/transactions";

// -------------------------------------------------------------------------- //
//                             C O N S T A N T S                              //
// -------------------------------------------------------------------------- //
const CONTRACT_NAME = "crowdfunding";
// - - - - - - - - - - //
//   A C C O U N T S   //
// - - - - - - - - - - //
const ACCOUNTS      = simnet.getAccounts();
const OWNER         = ACCOUNTS.get("deployer")!;
const USER_1        = ACCOUNTS.get("wallet_1")!;
const USER_2        = ACCOUNTS.get("wallet_2")!;
const USER_3        = ACCOUNTS.get("wallet_3")!;
const USER_NO_FUNDS = ACCOUNTS.get("wallet_8")!;

// - - - - - - - - - - - - - - - - - //
//   C A M P A I G N   S T A T U S   //
// - - - - - - - - - - - - - - - - - //
const STATUS_PENDING   = 0;
const STATUS_ACTIVE    = 1;
const STATUS_FUNDED    = 2;
const STATUS_EXPIRED   = 3;
const STATUS_VOTE      = 4;
const STATUS_CANCELED  = 5;
const STATUS_COMPLETED = 6;

// - - - - - - - - - - - //
//   F U N C T I O N S   //
// - - - - - - - - - - - //
const FUNCTION_CHECK_DEADLINE            = "check-deadline";
const FUNCTION_CHECK_VOTE_DEADLINE       = "check-vote-deadline";
const FUNCTION_CLAIM_REFUND              = "claim-refund";
const FUNCTION_CLAIM_MILESTONE_FUNDS     = "claim-milestone-funds";
const FUNCTION_CREATE_CAMPAIGN           = "create-campaign";
const FUNCTION_DONATE                    = "donate";
const FUNCTION_GET_BALANCE               = "get-balance";
const FUNCTION_GET_DONATION_AMOUNT       = "get-donation-amount";
const FUNCTION_GET_FUNDING_GOAL          = "get-funding-goal";
const FUNCTION_GET_STATUS                = "get-status";
const FUNCTION_GET_DEADLINE_BLOCK_HEIGHT = "get-deadline-block-height";
const FUNCTION_GET_MILESTONE             = "get-milestone";
const FUNCTION_GET_NUM_OF_MILESTONS      = "get-num-of-milestones";
const FUNCTION_GET_VOTE_END_BLOCK_HEIGHT = "get-vote-end-block-height";
const FUNCTION_POST_MILESTONE            = "post-milestone";
const FUNCTION_SET_STATUS                = "set-status";
const FUNCTION_VOTE                      = "vote";

// - - - - - - - - - - - - - //
//   E R R O R   C O D E S   //
// - - - - - - - - - - - - - //
const ERR_NOT_OWNER           = 400;
const ERR_ALREADY_CREATED     = 401;
const ERR_ZERO_TARGET_GOAL    = 402;
const ERR_ZERO_DURATION       = 403;
const ERR_ZERO_MILESTONES     = 404;
const ERR_ZERO_DONATION       = 405;
const ERR_NOT_ACTIVE          = 406;
const ERR_NOT_ENOUGH_FUNDS    = 407;
const ERR_FROZEN_FUNDS        = 409;
const ERR_NO_REFUND           = 410;
const ERR_OUT_OF_BOUNDS       = 412;
const ERR_MILESTONE_NOT_FOUND = 413;
const ERR_EMPTY_DETAILS       = 414;
const ERR_INVALID_STATUS      = 415;
const ERR_NO_DONATION         = 416;
const ERR_ALREADY_VOTED       = 417;
const ERR_ALREADY_CLAIMED     = 419;


// - - - - - - - - - - - - - //
//   T E S T   V A L U E S   //
// - - - - - - - - - - - - - //
const TARGET_GOAL       = 1000000000000; // int micro-STX
const DEADLINE_DURATION = 10000;         // in blocks
const NUM_OF_MILESTONES = 10;
const DONATION_AMOUNT   = 100000000000; // int micro-STX (for simplicity 10% of goal)
const MILESTONE_DETAILS = "Milestone Details";
const MILESTONE_INDEX   = 1;


describe(`Test: ${CONTRACT_NAME} contract`, () => {
// -------------------------------------------------------------------------- //
// TESTING FUNCTION:                                                          //
//         create-campaign(target-goal    uint)                               //
//                        (duration       uint)                               //
//                        (num-milestones uint)                               //
// -------------------------------------------------------------------------- //
  /**
   * Parameter validation: Calls the function passing invalid parameters.
   */
  it(`${FUNCTION_CREATE_CAMPAIGN}: argument validation`, async () => {
      // Invalid target-goal
      const {result: createCampaignCall1} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CREATE_CAMPAIGN,
          [uintCV(0), 
           uintCV(DEADLINE_DURATION),
           uintCV(NUM_OF_MILESTONES)
          ],
          OWNER
      );
      expect(createCampaignCall1).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse1 = createCampaignCall1 as ResponseErrorCV;
      expect(errorResponse1.value).toBeUint(ERR_ZERO_TARGET_GOAL);

      // Invalid duration
      const {result: createCampaignCall2} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CREATE_CAMPAIGN,
          [uintCV(TARGET_GOAL), 
           uintCV(0),
           uintCV(NUM_OF_MILESTONES)
          ],
          OWNER
      );
      expect(createCampaignCall2).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse2 = createCampaignCall2 as ResponseErrorCV;
      expect(errorResponse2.value).toBeUint(ERR_ZERO_DURATION);

      // Invalid num-milestones
      const {result: createCampaignCall3} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CREATE_CAMPAIGN,
          [uintCV(TARGET_GOAL), 
           uintCV(DEADLINE_DURATION),
           uintCV(0)
          ],
          OWNER
      );
      expect(createCampaignCall3).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse3 = createCampaignCall3 as ResponseErrorCV;
      expect(errorResponse3.value).toBeUint(ERR_ZERO_MILESTONES);
  });

  /**
   * Calls the function more than one times.
   * Before creating the campaign the status should STATUS_PENDING. 
   * The first call should be allowed (provided valid parameters) and any
   * subsequent calls should be blocked (i.e., error out) as the status changed
   * from STATUS_PENDING (to STATUS_ACTIVE).
   * Moreover, if there is any call from an address that is not the owner it
   * should detect it and throw the appropriate error.
   */
  it(`${FUNCTION_CREATE_CAMPAIGN}: should prevent multiple calls`, async () => {
      // Get the campaign status which should be STATUS_PENDING
      let status = await getStatus()!;
      expect(status).toEqual(STATUS_PENDING);

      // First call
      createCampaign();

      // Get the campaign status which should be STATUS_ACTIVE
      status = await getStatus()!;
      expect(status).toEqual(STATUS_ACTIVE);

      // Second call: This is a call by the owner 
      //              It should return an ERR_ALREADY_CREATED error
      const {result: createCampaignCall2} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CREATE_CAMPAIGN,
          [uintCV(TARGET_GOAL),
           uintCV(DEADLINE_DURATION),
           uintCV(NUM_OF_MILESTONES)
          ],
          OWNER
      );
      expect(createCampaignCall2).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse1 = createCampaignCall2 as ResponseErrorCV;
      expect(errorResponse1.value).toBeUint(ERR_ALREADY_CREATED);

      // Second call: This is a call by a non-owner address
      //              It should return an ERR_NOT_OWNER error
      const {result: createCampaignCall3} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CREATE_CAMPAIGN,
          [uintCV(TARGET_GOAL),
           uintCV(DEADLINE_DURATION),
           uintCV(NUM_OF_MILESTONES)
          ],
          USER_1
      );
      expect(createCampaignCall3).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse3 = createCampaignCall3 as ResponseErrorCV;
      expect(errorResponse3.value).toBeUint(ERR_NOT_OWNER);
  });

  /**
   * Calls the function once.
   * Then retrieves the values that are passed to ensure that they are stored
   * successfully.
   * 
   * Note: This unit-test tests indirecty the following functions:
   *       get-funding-goal()
   *       get-deadline-block-height()
   *       get-num-of-milestones()
   */
  it(`${FUNCTION_CREATE_CAMPAIGN}: should store the passed paramenter values`, async () => {
      // Call that stores the values (i.e., target goal, duration, number of
      // milestones)
      createCampaign();

      // Verify the value stored for the crowdfunding goal
      const {result: getGundingGoal} = simnet.callReadOnlyFn(
          CONTRACT_NAME,
          FUNCTION_GET_FUNDING_GOAL,
          [],
          USER_1
      );
      expect(getGundingGoal).toBeUint(TARGET_GOAL);

      // Verify the value stored for the duration. We must ensure that the
      // the deadline block height is greater than zero (as it is initialized
      // to zero)
      const {result: getDeadlineBlockHeight} = simnet.callReadOnlyFn(
          CONTRACT_NAME,
          FUNCTION_GET_DEADLINE_BLOCK_HEIGHT,
          [],
          USER_1
      );
      const deadlineBlockHeight = (getDeadlineBlockHeight as UIntCV).value;
      expect(deadlineBlockHeight).toBeGreaterThan(0);

      // Verify the value stored for the total number of campaign milestones
      const {result: getNumOfMilestones} = simnet.callReadOnlyFn(
          CONTRACT_NAME,
          FUNCTION_GET_NUM_OF_MILESTONS,
          [],
          USER_1
      );
      expect(getNumOfMilestones).toBeUint(NUM_OF_MILESTONES);
  });

// -------------------------------------------------------------------------- //
// TESTING FUNCTION:                                                          //
//         donate(amount uint)                                                //
// -------------------------------------------------------------------------- //
  /**
   * Calls the function passing zero as donation amount.
   * The call should throw a ERR_ZERO_DONATION error.
   */
  it(`${FUNCTION_DONATE}: argument validation`, async () => {
      // Create a campaign (this will set the status to STATUS_ACTIVE)
      createCampaign();

      // Call donate(amount uint) with zero donation amount
      const {result: donateCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_DONATE,
          [uintCV(0)],
          USER_1
      );
      expect(donateCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = donateCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_ZERO_DONATION);
  });

  /**
   * Calls the function when the status it not STATUS_ACTIVE.
   * The call should throw a ERR_NOT_ACTIVE error.
   */
  it(`${FUNCTION_DONATE}: active campaign status verification`, async () => {
      for (const status of [STATUS_PENDING, STATUS_FUNDED,
                            STATUS_EXPIRED, STATUS_VOTE, STATUS_CANCELED]) {
          // Set the status to { PENDING, FUNDED, EXPIRED, VOTE, CANCELED}
          setStatus(status);

          // Call donate(amount uint) with campaign status other than ACTIVE
          const {result: donateCall} = simnet.callPublicFn(
              CONTRACT_NAME,
              FUNCTION_DONATE,
              [uintCV(DONATION_AMOUNT)],
              USER_1
          );
          expect(donateCall).toHaveClarityType(ClarityType.ResponseErr);
          const errorResponse = donateCall as ResponseErrorCV;
          expect(errorResponse.value).toBeUint(ERR_NOT_ACTIVE);
      }
  });

  /**
   * Calls the function when the contributor does not have enough funds to 
   * donate.
   */
  it(`${FUNCTION_DONATE}: not enough funds to donate`, async () => {
      // Create a campaign (this will set the status to STATUS_ACTIVE)
      createCampaign();

      // Call donate(amount uint) 
      const {result: donateCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_DONATE,
          [uintCV(DONATION_AMOUNT)],
          USER_NO_FUNDS
      );
      expect(donateCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = donateCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_NOT_ENOUGH_FUNDS);
  });

  /**
   * Calls the function when the contributor has funds to donate and the
   * campaign is active.
   * The function call should succeed and the donation should be recorded.
   * Any subsequent donations by the same contributor should increment the total
   * donated amount.
   */
  it(`${FUNCTION_DONATE}: succesful back-to-back donations by the same address`, async () => {
      // Create a campaign (this will set the status to STATUS_ACTIVE)
      createCampaign();
      
      let expectedTotalDonation = 0;
      const assetsMap = simnet.getAssetsMap().get("STX")!;
      const initUserFunds  = Number(assetsMap.get(USER_1));

      for (let i = 0; i < 2; i++) {
          // USER_1 donates DONATION_AMOUNT to the capaign
          donate(USER_1, DONATION_AMOUNT);

          // Check the total donation amount by USER_1
          expectedTotalDonation += DONATION_AMOUNT;
          const {result: getDonationAmountCall} = simnet.callReadOnlyFn(
              CONTRACT_NAME,
              FUNCTION_GET_DONATION_AMOUNT,
              [principalCV(USER_1)],
              USER_1
          );
          expect(getDonationAmountCall).toBeUint(expectedTotalDonation);
          const assetsMap = simnet.getAssetsMap().get("STX")!;
          // Verify that the funds are transferred to the contract
          let contractFunds = await getContractFunds();
          expect(contractFunds).to.equal(expectedTotalDonation);
          // Verify that the funds are taken from the user
          let currUserFunds  = Number(assetsMap.get(USER_1));
          expect(currUserFunds).to.equal(initUserFunds - expectedTotalDonation);
      }
  });

  /**
   * Calls the function twice for two different users. The total donation amount
   * exceeds the crowdfundting goal.
   * Therefore, the campaign status should change to STATUS_FUNDED.
   */
  it(`${FUNCTION_DONATE}: multiple user donations; goal is met`, async () => {
      // Create a campaign (this will set the status to STATUS_ACTIVE)
      createCampaign();
  
      donate(USER_1, TARGET_GOAL - 4 * DONATION_AMOUNT); 
      donate(USER_1, DONATION_AMOUNT); 
      donate(USER_2, 2 * DONATION_AMOUNT);
      // The campaign is not funded yet
      let status = await getStatus()!;
      expect(status).toEqual(STATUS_ACTIVE);
      // The campaign now funded yet
      donate(USER_3, 1 * DONATION_AMOUNT);
      // Verify that the status changed to STATUS_FUNDED
      status = await getStatus()!;
      expect(status).toEqual(STATUS_FUNDED);
  });


// -------------------------------------------------------------------------- //
// TESTING FUNCTION:                                                          //
//         check-deadline()                                                   //
// -------------------------------------------------------------------------- //
  /**
   * Calls the function when the status is not STATUS_ACTIVE.
   * The status should remain the same.
   */
  it(`${FUNCTION_CHECK_DEADLINE}: the campaign is not ACTIVE`, async () => {
      for (const status of [STATUS_PENDING, STATUS_FUNDED,
                            STATUS_EXPIRED, STATUS_VOTE, STATUS_CANCELED]) {
          // Set the status to { PENDING, FUNDED, EXPIRED, VOTE, CANCELED}
          setStatus(status);

          // Call check-deadline()
          const campaignStatus = await checkDeadline();
          expect(campaignStatus).to.equal(status);
      }
  });

  /**
   * Calls the function when a campaign is created (i.e., the status is
   * STATUS_ACTIVE and the deadline has not passed).
   * The status should remain STATUS_ACTIVE.
   */
  it(`${FUNCTION_CHECK_DEADLINE}: the campaign is ACTIVE; the deadline did not pass`, async () => {
      // Create a campaign (this will set the status to STATUS_ACTIVE)
      createCampaign();

      // Call check-deadline()
      const campaignStatus = await checkDeadline();
      expect(campaignStatus).to.equal(STATUS_ACTIVE);
  }); 

  /**
    * Calls the function when the status is STATUS_ACTIVE and the deadline has
    * passed. We can achieve this by not creaging a campaign but setting the
    * status to STATUS_ACTIVE via set-status which is used for testing purposes.
    * The status should change STATUS_EXPIRED.
    */
  it(`${FUNCTION_CHECK_DEADLINE}: the campaign is ACTIVE; the deadline passed`, async () => {
      // Set the status to STATUS_ACTIVE
      setStatus(STATUS_ACTIVE);
  
      // Call check-deadline()
      const campaignStatus = await checkDeadline();
      expect(campaignStatus).to.equal(STATUS_EXPIRED);
   });

// -------------------------------------------------------------------------- //
// TESTING FUNCTION:                                                          //
//         post-milestone (details (string-ascii 100))                        //
//                        (index   uint)                                      //
// -------------------------------------------------------------------------- //
  /**
    * The owner calls the function when the status is other than FUNDED.
    * It should throw an ERR_INVALID_STATUS error.
    */
  it(`${FUNCTION_POST_MILESTONE}: the campaign status is other than FUNDED`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();

      for (const status of [STATUS_PENDING, STATUS_ACTIVE,
                            STATUS_EXPIRED, STATUS_VOTE, STATUS_CANCELED]) {
          // Set the status to { PENDING, ACTIVE, EXPIRED, VOTE, CANCELED}
          setStatus(status);

          // Call post-milestone (details (string-ascii 100))
          //                     (index   uint)
          const {result: postMilestoneCall} = simnet.callPublicFn(
              CONTRACT_NAME,
              FUNCTION_POST_MILESTONE,
              [stringAsciiCV(MILESTONE_DETAILS),
               uintCV(MILESTONE_INDEX),
              ],
              OWNER
          );
          expect(postMilestoneCall).toHaveClarityType(ClarityType.ResponseErr);
          const errorResponse = postMilestoneCall as ResponseErrorCV;
          expect(errorResponse.value).toBeUint(ERR_INVALID_STATUS);
      }
  });

  /**
   * The owner calls the function when the status is FUNDED but with a milestone
   * index that is out of bounds.
   * It should throw an ERR_OUT_OF_BOUNDS error.
   */
  it(`${FUNCTION_POST_MILESTONE}: the milestone index is out of bounds`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // Set the campaign status to STATUS_FUNDED
      setStatus(STATUS_FUNDED);
  
      // Call post-milestone (details (string-ascii 100))
      //                     (index   uint)
      const {result: postMilestoneCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_POST_MILESTONE,
          [stringAsciiCV(MILESTONE_DETAILS),
           uintCV(NUM_OF_MILESTONES + 1), // Out of bounds
          ],
          USER_1
      );
      expect(postMilestoneCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = postMilestoneCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_OUT_OF_BOUNDS);
  });

  /**
   * Calls the function when the status is FUNDED. However, the caller is not
   * the owner.
   * It should throw an ERR_NOT_OWNER error.
   */
  it(`${FUNCTION_POST_MILESTONE}: called by user other then the owner`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // Set the campaign status to STATUS_FUNDED
      setStatus(STATUS_FUNDED);

      // Call post-milestone (details (string-ascii 100))
      //                     (index   uint)
      const {result: postMilestoneCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_POST_MILESTONE,
          [stringAsciiCV(MILESTONE_DETAILS),
           uintCV(MILESTONE_INDEX),
          ],
          USER_1
      );
      expect(postMilestoneCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = postMilestoneCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_NOT_OWNER);
  });

  /**
   * The owner calls the function when the status is FUNDED with a valid
   * milestone index but with empty milestone details text.
   * It should throw an ERR_EMPTY_DETAILS error.
   */
  it(`${FUNCTION_POST_MILESTONE}: empty milestone details text`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // Set the campaign status to STATUS_FUNDED
      setStatus(STATUS_FUNDED);

      // Call post-milestone(details (string-ascii 100))
      //                    (index   uint)
      const {result: postMilestoneCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_POST_MILESTONE,
          [stringAsciiCV(""), // Empty milestone details
           uintCV(MILESTONE_INDEX),
          ],
          OWNER
      );
      expect(postMilestoneCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = postMilestoneCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_EMPTY_DETAILS);
  });

  /**
   * The owner calls the function when the status is FUNDED. The milestone index
   * is valide and the milestone details text is not empty.
   * The call should succed and the status should change to VOTE.
   * The milestone details should match the text returned from a call to
   * function `get-milestone (index uint)` using same the milestone index.
   */
  it(`${FUNCTION_POST_MILESTONE}: successful milestones post`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // Set the campaign status to STATUS_FUNDED
      setStatus(STATUS_FUNDED);
      // The onwer posts a milestone successfully
      postMilestone(MILESTONE_INDEX);

      // Get the campaign status which should be STATUS_VOTE
      const status = await getStatus()!;
      expect(status).toEqual(STATUS_VOTE);

      // Verify that the voting deadline has been updated (i.e., value greater
      // then 0 that it was initially)
      const {result: getVoteEndBlockHeightCall} = simnet.callReadOnlyFn(
          CONTRACT_NAME,
          FUNCTION_GET_VOTE_END_BLOCK_HEIGHT,
          [],
          USER_1 // Anyone can get the deadline height, not just the owner
      );
      const voteEndBlockHeight = (getVoteEndBlockHeightCall as UIntCV).value;
      expect(voteEndBlockHeight).toBeGreaterThan(0);

      // Check the milestone details by calling get-milestone (index uint)
      const {result: getMilestoneCall} = simnet.callReadOnlyFn(
          CONTRACT_NAME,
          FUNCTION_GET_MILESTONE,
          [uintCV(MILESTONE_INDEX)],
          USER_1 // Anyone can get the deadline height, not just the owner
      );
      expect(getMilestoneCall).toHaveClarityType(ClarityType.ResponseOk);
      const value = ((getMilestoneCall as ResponseOkCV).value as SomeCV).value;
      const text  = (value as StringAsciiCV).data;
      expect(text).toEqual(MILESTONE_DETAILS);
  });

// -------------------------------------------------------------------------- //
// TESTING FUNCTION:                                                          //
//         check-vote-deadline()                                              //
// -------------------------------------------------------------------------- //
  /**
   * Calls the function when the status is not STATUS_VOTE.
   * The status should remain the same.
   */
  it(`${FUNCTION_CHECK_VOTE_DEADLINE}: the campaign status is not STATUS-VOTE`, async () => {
      for (const status of [STATUS_PENDING, STATUS_ACTIVE,
                            STATUS_FUNDED, STATUS_EXPIRED, STATUS_CANCELED]) {
          // Set the status to { PENDING, ACTIVE, FUNDED, EXPIRED, CANCELED }
          setStatus(status);
  
          // Call check-vote-deadline()
          const campaignStatus = await checkVoteDeadline();
          expect(campaignStatus).to.equal(status);
      }
  });

  /**
   * Calls when the status is STATUS_VOTE and the voting deadline passed.
   * The status should change to STATUS_FUNDED.
   */
  it(`${FUNCTION_CHECK_VOTE_DEADLINE}: the voting deadline passed`, async () => {
      // Set the status to ACTIVE
      setStatus(STATUS_VOTE);

      // Call check-vote-deadline()
      const campaignStatus = await checkVoteDeadline();
      expect(campaignStatus).to.equal(STATUS_FUNDED);
  }); 

  /**
   * Calls when the status is STATUS_VOTE and the voting deadline did not pass.
   * The status should remain STATUS_VOTE.
   */
  it(`${FUNCTION_CHECK_VOTE_DEADLINE}: the voting deadline did not pass`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // Set the campaign status to STATUS_FUNDED
      setStatus(STATUS_FUNDED);
      // The onwer posts a milestone successfully
      postMilestone(MILESTONE_INDEX);

      // Call check-vote-deadline()
      const campaignStatus = await checkVoteDeadline();
      expect(campaignStatus).to.equal(STATUS_VOTE);
  });

// -------------------------------------------------------------------------- //
// TESTING FUNCTION:                                                          //
//         vote (index uint)                                                  //
//              (value bool)                                                  //
// -------------------------------------------------------------------------- //
  /**
   * Calls the function when the status is not STATUS_VOTE.
   * The call should throw an ERR_INVALID_STATUS error.
   */
  it(`${FUNCTION_VOTE}: the campaign status is not STATUS-VOTE`, async () => {
      for (const status of [STATUS_PENDING, STATUS_ACTIVE,
                            STATUS_FUNDED, STATUS_EXPIRED, STATUS_CANCELED]) {
          // Set the status to { PENDING, ACTIVE, FUNDED, EXPIRED, CANCELED }
          setStatus(status);
   
          // Call (index uint)
          //      (value bool)
          const {result: voteCall} = simnet.callPublicFn(
              CONTRACT_NAME,
              FUNCTION_VOTE,
              [uintCV(MILESTONE_INDEX),
               boolCV(false)
              ],
              USER_1
          );
          expect(voteCall).toHaveClarityType(ClarityType.ResponseErr);
          const errorResponse = voteCall as ResponseErrorCV;
          expect(errorResponse.value).toBeUint(ERR_INVALID_STATUS);
    }
  });

  /**
   * Calls the function when the status is STATUS_VOTE with a milestone index
   * that is out of bounds.
   * The call should throw an ERR_OUT_OF_BOUNDS error.
   */
  it(`${FUNCTION_VOTE}: index is out of bounds`, async () => {
     // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
     createCampaign();
     // Set the campaign status to STATUS_FUNDED
     setStatus(STATUS_FUNDED);
     // The onwer posts a milestone successfully
     postMilestone(MILESTONE_INDEX);

      // Call (index uint)
      //      (value bool)
      const {result: voteCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_VOTE,
          [uintCV(NUM_OF_MILESTONES + 1), // Out of bounds
           boolCV(false)
          ],
          USER_1
      );
      expect(voteCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = voteCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_OUT_OF_BOUNDS);
  });

  /**
   * Calls the function when the status is STATUS_VOTE.
   * The caller has not donated.
   * The call should throw an ERR_NO_DONATION error.
   */
  it(`${FUNCTION_VOTE}: user has not donated`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // Set the campaign status to STATUS_FUNDED
      setStatus(STATUS_FUNDED);
      // The onwer posts a milestone successfully
      postMilestone(MILESTONE_INDEX);

      // Call (index uint)
      //      (value bool)
      const {result: voteCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_VOTE,
          [uintCV(MILESTONE_INDEX),
           boolCV(false)
          ],
          USER_1
      );
      expect(voteCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = voteCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_NO_DONATION);
  });

  /**
   * Calls the function when the status is STATUS_VOTE.
   * The caller has donated but attemps to vote for a milestone that does is not
   * posted yet.
   * The call should throw an ERR_MILESTONE_NOT_FOUND error.
   */
  it(`${FUNCTION_VOTE}: select milestone that does not exist`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // USER_1 donates DONATION_AMOUNT to the capaign
      donate(USER_1, DONATION_AMOUNT);
      // Set the campaign status to STATUS_FUNDED
      setStatus(STATUS_FUNDED);
      // The onwer posts a milestone successfully
      postMilestone(MILESTONE_INDEX);

      // Call (index uint)
      //      (value bool)
      const {result: voteCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_VOTE,
          [uintCV(MILESTONE_INDEX + 1),
           boolCV(false)
          ],
          USER_1
      );
      expect(voteCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = voteCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_MILESTONE_NOT_FOUND);
  });

  /**
   * Calls the function when the status is STATUS_VOTE.
   * The caller is eligible to vote.
   * The call should succeed.
   */
  it(`${FUNCTION_VOTE}: successful vote`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // USER_1 donates DONATION_AMOUNT to the capaign
      donate(USER_1, DONATION_AMOUNT);
      // Set the campaign status to STATUS_FUNDED
      setStatus(STATUS_FUNDED);
      // The onwer posts a milestone successfully
      postMilestone(MILESTONE_INDEX);

      // Call (index uint)
      //      (value bool)
      await vote(USER_1, MILESTONE_INDEX, true);
  }); 

  /**
   * Calls the function when the status is STATUS_VOTE.
   * The caller is eligible to vote.
   * The first call should succeed but the second should throw an
   * ERR_ALREADY_VOTED error.
   */
  it(`${FUNCTION_VOTE}: vote twice`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // USER_1 donates DONATION_AMOUNT to the capaign
      donate(USER_1, DONATION_AMOUNT);
      // USER_2 donates most amount equal to TARGET_GOAL which means that the
      // campaign is funded 
      donate(USER_2, TARGET_GOAL);
      // The onwer posts a milestone successfully
      postMilestone(MILESTONE_INDEX);

      // First call
      await vote(USER_1, MILESTONE_INDEX, false);

      // Second call
      const {result: voteCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_VOTE,
          [uintCV(MILESTONE_INDEX),
            boolCV(false)
          ],
          USER_1
      );
      expect(voteCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = voteCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_ALREADY_VOTED);
  });   

  /**
   * Calls the function when the status is STATUS_VOTE.
   * The caller is eligible to vote. The caller has donated more than 50% of the
   * total donations which means that the user's vote determines the fate of the
   * campaign. The user gives a vote of no confidence, which means that a vote
   * of no confidence is passed.
   * Thus, the campaign status after the user's vote should be STATUS_CANCELED.
   */
  it(`${FUNCTION_VOTE}: majority vote of no confidence`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // USER_1 contributes 90% of total donations to the capaign
      donate(USER_1, TARGET_GOAL - DONATION_AMOUNT);
      // USER_2 contributes 10% of total donations to the capaign
      donate(USER_2, DONATION_AMOUNT);
      // The onwer posts a milestone successfully
      postMilestone(MILESTONE_INDEX);
      
      // USER_1 votes and as a result a vote of no confidence passes
      await vote(USER_1, MILESTONE_INDEX, false);
      // Check the status after the vote
      let status = await getStatus()!;
      expect(status).toEqual(STATUS_CANCELED);
  }); 

  /**
   * Calls the function when the status is STATUS_VOTE.
   * The caller is eligible to vote. The caller has donated more than 50% of the
   * total donations which means that the user's vote determines the fate of the
   * campaign. The user gives a vote of no confidence, which means that a vote
   * of no confidence is passed.
   * Thus, the campaign status after the user's vote should be back to 
   * STATUS_FUNDED.
   */
  it(`${FUNCTION_VOTE}: majority vote of confidence`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // USER_1 contributes 90% of total donations to the capaign
      donate(USER_1, TARGET_GOAL - DONATION_AMOUNT);
      // USER_2 contributes 10% of total donations to the capaign
      donate(USER_2, DONATION_AMOUNT);
      // The onwer posts a milestone successfully
      postMilestone(MILESTONE_INDEX);
    
      // USER_1 votes and as a result a vote of confidence passes
      await vote(USER_1, MILESTONE_INDEX, true);
      // Check the status after the vote
      let status = await getStatus()!;
      expect(status).toEqual(STATUS_FUNDED);
  });

// -------------------------------------------------------------------------- //
// TESTING FUNCTION:                                                          //
//         claim-refund()                                                     //
// -------------------------------------------------------------------------- //
  /**
   * Calls the function when the status is not STATUS_EXPIRED or STATUS_CANCELED
   * The call should throw a ERR_FROZEN_FUNDS error.
   */
  it(`${FUNCTION_CLAIM_REFUND}: the campaign status is neither EXPIRED nor CANCELED`, async () => {
      for (const status of [STATUS_PENDING, STATUS_ACTIVE, STATUS_FUNDED]) {
          setStatus(status);
          // Call claim-refund()
          const {result: claimRefundCall} = simnet.callPublicFn(
              CONTRACT_NAME,
              FUNCTION_CLAIM_REFUND,
              [],
              USER_1
          );
          expect(claimRefundCall).toHaveClarityType(ClarityType.ResponseErr);
          const errorResponse = claimRefundCall as ResponseErrorCV;
          expect(errorResponse.value).toBeUint(ERR_FROZEN_FUNDS);
        }
  });

  /**
   * Calls the function when the status is STATUS_EXPIRED but the caller has
   * not donated to the campaign.
   * The call should throw a ERR_NO_DONATION error.
   */
  it(`${FUNCTION_CLAIM_REFUND}: the campaign status EXPIRED but the user has not donated`, async () => {
      // Create a campaign (status will be STATUS_ACTIVE)
      createCampaign();
      // USER_1 donates DONATION_AMOUNT to the capaign
      donate(USER_1, DONATION_AMOUNT);
      // Set the status to EXPIRED which means the user is eligible for a refund
      setStatus(STATUS_EXPIRED);

      // Call claim-refund() - USER_2 has not donated
      const {result: claimRefundCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CLAIM_REFUND,
          [],
          USER_2
      );
      expect(claimRefundCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = claimRefundCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_NO_REFUND);
  });

 /**
   * Calls the function when the status is STATUS_EXPIRED and the caller has
   * donated to the campaign and therefore is eligible for a refund.
   * The call should succeed and both the contract's and the caller's wallets
   * should be updated accordingly.
   */
 it(`${FUNCTION_CLAIM_REFUND}: the user is eligible for a refund.`, async () => {
      // Create a campaign (status will be STATUS_ACTIVE)
      createCampaign();
      // USER_1 donates DONATION_AMOUNT to the capaign
      donate(USER_1, DONATION_AMOUNT);
      // Set the status to EXPIRED which means the user is eligible for a refund
      setStatus(STATUS_EXPIRED);

      let assetsMap = simnet.getAssetsMap().get("STX")!;
      let userFundsBeforeRefund = Number(assetsMap.get(USER_1));
      let contractFundsBeforeRefund = await getContractFunds();

      // Call claim-refund()
      const {result: claimRefundCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CLAIM_REFUND,
          [],
          USER_1
      );
      expect(claimRefundCall).toHaveClarityType(ClarityType.ResponseOk);
      // The function returns (ok refunded_amount). Check that amount
      const refundAmount = (claimRefundCall as ResponseOkCV).value;
      expect(refundAmount).toBeUint(DONATION_AMOUNT);

      // Verify that the funds are returned to the user
      assetsMap = simnet.getAssetsMap().get("STX")!;
      const refund = Number(assetsMap.get(USER_1)) - userFundsBeforeRefund;
      expect(refund).to.equal(DONATION_AMOUNT);
      // Verifty that the funds are taken from the contract
      let contractFundsAfterRefund = await getContractFunds();
      const takenFunds = contractFundsBeforeRefund -contractFundsAfterRefund;
      expect(takenFunds).to.equal(DONATION_AMOUNT);
  }); 

  /**
   * Calls the function when the status is STATUS_EXPIRED and the caller is
   * eligible for a refund. Then calls the function again.
   * The second call should throw an ERR_NO_REFUND error.
   */
  it(`${FUNCTION_CLAIM_REFUND}: claim refund twice.`, async () => {
      // Create a campaign (status will be STATUS_ACTIVE)
      createCampaign();
      // USER_1 donates DONATION_AMOUNT to the capaign
      donate(USER_1, DONATION_AMOUNT);
      // Set the status to EXPIRED which means the user is eligible for a refund
      setStatus(STATUS_EXPIRED);

      // Call claim-refund()
      claimRefund(USER_1);

      // Call claim-refund() again
      const {result: claimRefundCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CLAIM_REFUND,
          [],
          USER_1
      );
      expect(claimRefundCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = claimRefundCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_NO_REFUND);
  });

// -------------------------------------------------------------------------- //
// TESTING FUNCTION:                                                          //
//         claim-milestone-funds (index uint)                                 //
// -------------------------------------------------------------------------- //
  /**
    * The owner calls the function when the status is other than FUNDED.
    * It should throw an ERR_INVALID_STATUS error.
    */
  it(`${FUNCTION_CLAIM_MILESTONE_FUNDS}: the campaign status is other than FUNDED`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();

      for (const status of [STATUS_PENDING, STATUS_ACTIVE,
                            STATUS_EXPIRED, STATUS_VOTE, STATUS_CANCELED]) {
          // Set the status to { PENDING, ACTIVE, EXPIRED, VOTE, CANCELED}
          setStatus(status);

          // Call claim-milestone-funds (index uint)
          const {result: claimMilestoneFundsCall} = simnet.callPublicFn(
              CONTRACT_NAME,
              FUNCTION_CLAIM_MILESTONE_FUNDS,
              [uintCV(MILESTONE_INDEX)],
              OWNER
          );
          expect(claimMilestoneFundsCall).toHaveClarityType(ClarityType.ResponseErr);
          const errorResponse = claimMilestoneFundsCall as ResponseErrorCV;
          expect(errorResponse.value).toBeUint(ERR_INVALID_STATUS);
      }
  });

  /**
   * The owner calls the function when the status is FUNDED but with a milestone
   * index that is out of bounds.
   * It should throw an ERR_OUT_OF_BOUNDS error.
   */
  it(`${FUNCTION_CLAIM_MILESTONE_FUNDS}: the milestone index is out of bounds`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // Set the campaign status to STATUS_FUNDED
      setStatus(STATUS_FUNDED);

      // Call claim-milestone-funds (index uint)
      const {result: claimMilestoneFundsCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CLAIM_MILESTONE_FUNDS,
          [uintCV(NUM_OF_MILESTONES + 1)], // Out of bounds
          OWNER
      );
      expect(claimMilestoneFundsCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = claimMilestoneFundsCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_OUT_OF_BOUNDS);
  });

  /**
   * Calls the function when the status is FUNDED. However, the caller is not
   * the owner.
   * It should throw an ERR_NOT_OWNER error.
   */
  it(`${FUNCTION_CLAIM_MILESTONE_FUNDS}: called by user other then the owner`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // Set the campaign status to STATUS_FUNDED
      setStatus(STATUS_FUNDED);

      // Call claim-milestone-funds (index uint)
      const {result: claimMilestoneFundsCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CLAIM_MILESTONE_FUNDS,
          [uintCV(MILESTONE_INDEX)],
          USER_1
      );
      expect(claimMilestoneFundsCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = claimMilestoneFundsCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_NOT_OWNER);
  });

  /**
   * The owner calls the function when the status is FUNDED but with a milestone
   * index that does not exist (i.e., is not yet posted).
   * It should throw an ERR_MILESTONE_NOT_FOUND error.
   */
  it(`${FUNCTION_CLAIM_MILESTONE_FUNDS}: the milestone index is out of bounds`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // Set the campaign status to STATUS_FUNDED
      setStatus(STATUS_FUNDED);

      // Call claim-milestone-funds (index uint)
      const {result: claimMilestoneFundsCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CLAIM_MILESTONE_FUNDS,
          [uintCV(MILESTONE_INDEX)], // The owner has not posted the milestone
          OWNER
      );
      expect(claimMilestoneFundsCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = claimMilestoneFundsCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_MILESTONE_NOT_FOUND);
  });  

  /**
   * The owner claims successfully the milestone
   */
  it(`${FUNCTION_CLAIM_MILESTONE_FUNDS}: sucessful milestone claim`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // USER_1 contributes 100% of total donations to the capaign
      donate(USER_1, TARGET_GOAL);

      // The onwer posts a milestone successfully
      postMilestone(MILESTONE_INDEX);
      // A vote of confidence passes, which means that the onwer can claim the
      // milestone funds
      await vote(USER_1, MILESTONE_INDEX, true);

      // Get the owner's and the contract's balance before claiming the milestone
      let assetsMap = simnet.getAssetsMap().get("STX")!;
      let ownerFundsBefore = Number(assetsMap.get(OWNER));
      let contractFundsBefore = await getContractFunds();
      // Verify the the contract's funds equal to TARGET_GOAL
      expect(contractFundsBefore).to.equal(TARGET_GOAL);
      // Therefore, the funds that the owner can claim per milestone are:
      let milestoneFunds = TARGET_GOAL / NUM_OF_MILESTONES;

      // Call claim-milestone-funds (index uint)
      const {result: claimMilestoneFundsCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CLAIM_MILESTONE_FUNDS,
          [uintCV(MILESTONE_INDEX)],
          OWNER
      );
      expect(claimMilestoneFundsCall).toHaveClarityType(ClarityType.ResponseOk);

      // Verify that milestoneFunds are transferred to the owner
      assetsMap = simnet.getAssetsMap().get("STX")!;
      const transferredFunds = Number(assetsMap.get(OWNER)) - ownerFundsBefore;
      expect(transferredFunds).to.equal(milestoneFunds);
      // Verifty that the funds are taken from the contract
      let contractFundsAfter = await getContractFunds();
      const takenFunds = contractFundsBefore - contractFundsAfter;
      expect(takenFunds).to.equal(transferredFunds);
  });

  /**
   * The owner tries is eligible to claim the milestone but tries to do that
   * twice. The second attempt should throw an ERR_ALREADY_CLAIMED error.
   */
  it(`${FUNCTION_CLAIM_MILESTONE_FUNDS}: claim milestone twice`, async () => {
      // Create a campaign (sets the number of milestones to NUM_OF_MILESTONES)
      createCampaign();
      // USER_1 contributes 100% of total donations to the capaign
      donate(USER_1, TARGET_GOAL);
      // The onwer posts a milestone successfully
      postMilestone(MILESTONE_INDEX);
      // A vote of confidence passes, which means that the onwer can claim the
      // milestone funds
      await vote(USER_1, MILESTONE_INDEX, true);

      // Claim the milestone
      const {result: claimMilestoneFundsCall1} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CLAIM_MILESTONE_FUNDS,
          [uintCV(MILESTONE_INDEX)],
          OWNER
      );
      expect(claimMilestoneFundsCall1).toHaveClarityType(ClarityType.ResponseOk);

      // Try to reclaim the milestone
      const {result: claimMilestoneFundsCall2} = simnet.callPublicFn(
         CONTRACT_NAME,
         FUNCTION_CLAIM_MILESTONE_FUNDS,
         [uintCV(MILESTONE_INDEX)],
         OWNER
      );
      expect(claimMilestoneFundsCall2).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = claimMilestoneFundsCall2 as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_ALREADY_CLAIMED);
  });

  /**
   * The owner is eligible to claim the milestone, which is the only remaining
   * milestone.
   * The campaign status should change to STATUS_COMPLETED.
   */
  it(`${FUNCTION_CLAIM_MILESTONE_FUNDS}: claim milestone twice`, async () => {
      // Create a campaign and set the number of milestons to 1
      const {result: createCampaignCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CREATE_CAMPAIGN,
          [uintCV(TARGET_GOAL),
           uintCV(DEADLINE_DURATION),
           uintCV(1)
          ],
          OWNER
      );
      // The first time, we can call the function create-campaign
      expect(createCampaignCall).toHaveClarityType(ClarityType.ResponseOk); 
      // USER_1 contributes 100% of total donations to the capaign
      donate(USER_1, TARGET_GOAL);
      // The onwer posts a milestone successfully
      postMilestone(MILESTONE_INDEX);
      // A vote of confidence passes, which means that the onwer can claim the
      // milestone funds
      await vote(USER_1, MILESTONE_INDEX, true);

      // Claim the milestone
      const {result: claimMilestoneFundsCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CLAIM_MILESTONE_FUNDS,
          [uintCV(MILESTONE_INDEX)],
          OWNER
      );
      expect(claimMilestoneFundsCall).toHaveClarityType(ClarityType.ResponseOk);

      // Get the campaign status which should be STATUS_COMPLETED
      let status = await getStatus()!;
      expect(status).toEqual(STATUS_COMPLETED);
  });


// -------------------------------------------------------------------------- //
//                              S C E N A R I O S                             //
// -------------------------------------------------------------------------- //
  /**
   * -----------
   * Scenario 1:
   * -----------
   * We have 3 users who donate to the campaign.
   * - The crowndfunding goal is not reached by the deadline.
   * - The users who donated claim a refund.
   */
  it("Scenario 1: 3 donors; goal is not met by the deadline", async () => {
      // Create a new campaign
      createCampaign();

      // Verify that the initially the contract has no funds
      expect(await getContractFunds()).to.equal(0);

      let assetsMap = simnet.getAssetsMap().get("STX")!;
      let user1FundsInit = Number(assetsMap.get(USER_1));
      let user2FundsInit = Number(assetsMap.get(USER_2));
      let user3FundsInit = Number(assetsMap.get(USER_3));
  
      // User 1 total: 2 * DONATION_AMOUNT (donates twice)
      donate(USER_1, DONATION_AMOUNT);
      let userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_1));
      expect(userFunds).to.equal(user1FundsInit - DONATION_AMOUNT);
      donate(USER_1, DONATION_AMOUNT);
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_1));
      expect(userFunds).to.equal(user1FundsInit - 2 * DONATION_AMOUNT);
      // User 2
      donate(USER_2, 3 * DONATION_AMOUNT);
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_2));
      expect(userFunds).to.equal(user2FundsInit - 3 * DONATION_AMOUNT);
      // Third donor
      donate(USER_3, 2 * DONATION_AMOUNT);
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_3));
      expect(userFunds).to.equal(user3FundsInit - 2 * DONATION_AMOUNT);
      
      //Set the deadline to zero (allowed only in TEST mode)
      simnet.callPrivateFn(
          CONTRACT_NAME,
          "set-deadline-block-height",
          [uintCV(2)],
          OWNER // Don't care value
      );

      // Check if the deadline passed
      const campaignStatus = await checkDeadline();
      expect(campaignStatus).to.equal(STATUS_EXPIRED);

      // Try to donate again. However, since the campaign deadline passed,
      // the donation should be rejected
      const {result: donateCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_DONATE,
          [uintCV(DONATION_AMOUNT)],
          USER_1
      );
      expect(donateCall).toHaveClarityType(ClarityType.ResponseErr);
      const errorResponse = donateCall as ResponseErrorCV;
      expect(errorResponse.value).toBeUint(ERR_NOT_ACTIVE);

      // Validate contract's balance
      expect(await getContractFunds()).to.equal(7 * DONATION_AMOUNT);

      // User 1 claims the refund
      claimRefund(USER_1);
      // Validate User 1's balance
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_1));
      expect(userFunds).to.equal(user1FundsInit);

      // User 2 claims the refund
      claimRefund(USER_2);
      // Validate User 2's balance
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_2));
      expect(userFunds).to.equal(user2FundsInit);

      // User 3 claims the refund
      claimRefund(USER_3);
      // Validate User 3's balance
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_3));
      expect(userFunds).to.equal(user3FundsInit);

      // Validate contract's balance
      expect(await getContractFunds()).to.equal(0);
  });

  /**
   * -----------
   * Scenario 2:
   * -----------
   * We have 3 users who donate to the campaign.
   * - The crowndfunding goal is reached.
   * - The project manager posts a milestone.
   * - A majority vote of confidence passes, which means that the project
   *   continues.
   * - The project manager claims the milestone.
   * - The project managers posts another milestone.
   * - This time, a majority vote of no-confidence passes, which means that the
   *   project is cancelled.
   * - The users claim a partial refund proportional to their donation amount.
   */
  it("Scenario 2: 3 donors; campaign is funded, milestone 1 passes, milestone 2 does not pass.", async () => {
      // Create a new campaign
      createCampaign();

      // Verify that initially the contract has no funds
      expect(await getContractFunds()).to.equal(0);

      let assetsMap = simnet.getAssetsMap().get("STX")!;
      let ownerFundsInit = Number(assetsMap.get(OWNER));
      let user1FundsInit = Number(assetsMap.get(USER_1));
      let user2FundsInit = Number(assetsMap.get(USER_2));
      let user3FundsInit = Number(assetsMap.get(USER_3));

      // Note: The TARGET_GOAL = 10 * DONATION_AMOUNT
      // Just in case the constants change accidentally...
      expect(TARGET_GOAL).to.equal(10 * DONATION_AMOUNT);

      // User 1 total: 2 * DONATION_AMOUNT (donates twice)
      donate(USER_1, DONATION_AMOUNT);
      let userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_1));
      expect(userFunds).to.equal(user1FundsInit - DONATION_AMOUNT);
      donate(USER_1, DONATION_AMOUNT);
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_1));
      expect(userFunds).to.equal(user1FundsInit - 2 * DONATION_AMOUNT);
      // User 2
      donate(USER_2, 3 * DONATION_AMOUNT);
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_2));
      expect(userFunds).to.equal(user2FundsInit - 3 * DONATION_AMOUNT);
      // Third donor
      donate(USER_3, 2 * DONATION_AMOUNT);
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_3));
      expect(userFunds).to.equal(user3FundsInit - 2 * DONATION_AMOUNT);
      donate(USER_3, 5 * DONATION_AMOUNT);
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_3));
      expect(userFunds).to.equal(user3FundsInit - 7 * DONATION_AMOUNT);

      // Validate the campaign status now that the crowdfunding goal is reached
      let status = await getStatus()!;
      expect(status).toEqual(STATUS_FUNDED);

      // Contract's balance = 12 * DONATION_AMOUNT = 120% of the TARGET_GOAL
      let contractFundsInit = await getContractFunds();
      expect(contractFundsInit).to.equal(12 * DONATION_AMOUNT);

      // The project manager posts a milestone
      postMilestone(MILESTONE_INDEX);
      
      // Validate the campaign status (i.e., STATUS_VOTE)
      expect(await getStatus()!).toEqual(STATUS_VOTE);
      
      // User 1 (contributed 1/6 of the total donations) votes 'no confidence'
      vote(USER_1, MILESTONE_INDEX, false);
      // The majority threshold is not reached
      expect(await getStatus()!).toEqual(STATUS_VOTE);
      // User 3 (contributed 7/12 of the total donations) votes 'confidence'
      vote(USER_3, MILESTONE_INDEX, true);
      // The majority threshold is reached - a confidence vote passes, which
      // means the campaign continues (i.e., status changes to STATUS_FUNDED)
      expect(await getStatus()!).toEqual(STATUS_FUNDED);

      // The project manager claims the milestone funds
      await claimMilestone(MILESTONE_INDEX)!;

      // Validate owner's balance
      const milestoneAmount = contractFundsInit / NUM_OF_MILESTONES;
      let ownerFunds = Number(simnet.getAssetsMap().get("STX")!.get(OWNER));
      expect(ownerFunds).to.equal(ownerFundsInit + milestoneAmount);
      // Validate contract's balance
      expect(await getContractFunds()).to.equal(contractFundsInit - milestoneAmount);

      // The project manager posts a milestone
      postMilestone(MILESTONE_INDEX + 1);

      // Validate the campaign status (i.e., STATUS_VOTE)
      expect(await getStatus()!).toEqual(STATUS_VOTE);

      // User 3 (contributed 7/12 of the total donations) votes 'no confidence'
      vote(USER_3, MILESTONE_INDEX + 1, false);

      // Validate the campaign status (i.e., STATUS_CANCELED)
      expect(await getStatus()!).toEqual(STATUS_CANCELED);

     // User 1 claims the refund
     claimRefund(USER_1);
     // Validate User 1's balance
     // User 1 donated 1/6 of the overall funds - 1 milestone was claimed
     // Thus User 1 must have the initial funds - (milestoneAmount / 6)
     userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_1));
     expect(userFunds).to.equal(user1FundsInit - (milestoneAmount / 6));

     // User 2 claims the refund
     claimRefund(USER_2);
     // Validate User 2's balance
     // User 2 donated 1/4 of the overall funds - 1 milestone was claimed
     // Thus User 2 must have the initial funds - (milestoneAmount / 4)
     userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_2));
     expect(userFunds).to.equal(user2FundsInit - (milestoneAmount / 4));

     // User 3 claims the refund
     claimRefund(USER_3);
     // User 3 donated 7/12 of the overall funds - 1 milestone was claimed
     // Thus User 3 must have the initial funds - (7 * milestoneAmount / 12)
     userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_3));
     expect(userFunds).to.equal(user3FundsInit - (7 * milestoneAmount / 12));
     
    // Verify that the contract has no funds
    expect(await getContractFunds()).to.equal(0);
  });

  /**
   * -----------
   * Scenario 3:
   * -----------
   * We have 3 users who donate to the campaign.
   * - The crowndfunding goal is reached.
   * - The project manager posts a milestone.
   * - A majority vote of confidence passes, which means that the project
   *   continues.
   * - The project manager claims the milestone.
   * - The project managers posts another milestone.
   * - A majority vote of confidence passes, which means that the project
   *   continues to completion (since this the final milestone)
   * - The project manager claims the milestone and the campaign completes.
   */
  it("Scenario 3: 3 donors; campaign with 2 milestones is funded, both milestone pass, camaign completes.", async () => {
      const NUMBER_OF_MILESTONES = 2

      // Create a new campaign with 2 milestones
      simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CREATE_CAMPAIGN,
          [uintCV(TARGET_GOAL),
           uintCV(DEADLINE_DURATION),
           uintCV(NUMBER_OF_MILESTONES)
          ],
          OWNER
      );
 
      // Verify that initially the contract has no funds
      expect(await getContractFunds()).to.equal(0);

      let assetsMap = simnet.getAssetsMap().get("STX")!;
      let ownerFundsInit = Number(assetsMap.get(OWNER));
      let user1FundsInit = Number(assetsMap.get(USER_1));
      let user2FundsInit = Number(assetsMap.get(USER_2));
      let user3FundsInit = Number(assetsMap.get(USER_3));

      // Note: The TARGET_GOAL = 10 * DONATION_AMOUNT
      // Just in case the constants change accidentally...
      expect(TARGET_GOAL).to.equal(10 * DONATION_AMOUNT);

      // User 1 total: 2 * DONATION_AMOUNT (donates twice)
      donate(USER_1, DONATION_AMOUNT);
      let userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_1));
      expect(userFunds).to.equal(user1FundsInit - DONATION_AMOUNT);
      donate(USER_1, DONATION_AMOUNT);
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_1));
      expect(userFunds).to.equal(user1FundsInit - 2 * DONATION_AMOUNT);
      // User 2
      donate(USER_2, 3 * DONATION_AMOUNT);
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_2));
      expect(userFunds).to.equal(user2FundsInit - 3 * DONATION_AMOUNT);
      // Third donor
      donate(USER_3, 2 * DONATION_AMOUNT);
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_3));
      expect(userFunds).to.equal(user3FundsInit - 2 * DONATION_AMOUNT);
      donate(USER_3, 5 * DONATION_AMOUNT);
      userFunds = Number(simnet.getAssetsMap().get("STX")!.get(USER_3));
      expect(userFunds).to.equal(user3FundsInit - 7 * DONATION_AMOUNT);

      // Validate the campaign status now that the crowdfunding goal is reached
      let status = await getStatus()!;
      expect(status).toEqual(STATUS_FUNDED);

      // Contract's balance = 12 * DONATION_AMOUNT = 120% of the TARGET_GOAL
      let contractFundsInit = await getContractFunds();
      expect(contractFundsInit).to.equal(12 * DONATION_AMOUNT);

      // The project manager posts a milestone
      postMilestone(MILESTONE_INDEX);
    
      // Validate the campaign status (i.e., STATUS_VOTE)
      expect(await getStatus()!).toEqual(STATUS_VOTE);
    
      // User 1 (contributed 1/6 of the total donations) votes 'no confidence'
      vote(USER_1, MILESTONE_INDEX, false);
      // The majority threshold is not reached
      expect(await getStatus()!).toEqual(STATUS_VOTE);
      // User 3 (contributed 7/12 of the total donations) votes 'confidence'
      vote(USER_3, MILESTONE_INDEX, true);
      // The majority threshold is reached - a confidence vote passes, which
      // means the campaign continues (i.e., status changes to STATUS_FUNDED)
      expect(await getStatus()!).toEqual(STATUS_FUNDED);

      // The project manager claims the milestone funds
      await claimMilestone(MILESTONE_INDEX)!;

      // Validate owner's balance
      const milestoneAmount = contractFundsInit / NUMBER_OF_MILESTONES;
      let ownerFunds = Number(simnet.getAssetsMap().get("STX")!.get(OWNER));
      expect(ownerFunds).to.equal(ownerFundsInit + milestoneAmount);
      // Validate contract's balance
      expect(await getContractFunds()).to.equal(contractFundsInit - milestoneAmount);

      // The project manager posts a milestone
      postMilestone(MILESTONE_INDEX + 1);

      // Validate the campaign status (i.e., STATUS_VOTE)
      expect(await getStatus()!).toEqual(STATUS_VOTE);

      // User 3 (contributed 7/12 of the total donations) votes 'confidence'
      vote(USER_3, MILESTONE_INDEX + 1, true);
      // The majority threshold is reached - a confidence vote passes, which
      // means the campaign continues (i.e., status changes to STATUS_FUNDED)
      expect(await getStatus()!).toEqual(STATUS_FUNDED);

      // The project manager claims the milestone funds
      await claimMilestone(MILESTONE_INDEX + 1)!;

      // Validate owner's balance
      ownerFunds = Number(simnet.getAssetsMap().get("STX")!.get(OWNER));
      expect(ownerFunds).to.equal(ownerFundsInit + 2 * milestoneAmount);
      // Validate contract's balance
      expect(await getContractFunds()).to.equal(contractFundsInit - 2 * milestoneAmount);
      // Given that the campaign has only two milestones, the contract's balance
      // must be zero now
      expect(await getContractFunds()).to.equal(0);

      // Moreover, since there are no milestones left and the owner claimed the
      // final milestone, the campaign status should be STATUS_COMPLETED
      expect(await getStatus()!).toEqual(STATUS_COMPLETED);
  });

// -------------------------------------------------------------------------- //
//                      H E L P E R    F U N C T I O N S                      //
// -------------------------------------------------------------------------- //
  /**
   * Helper function that creates a new campaign.
   * Pre-condition : The campaign is not created before.
   * Post-condition: A new campaign is created wher the crowdfunding goal is
   *                 TARGET_GOAL, the campaign duration is DEADLINE_DURATION and
   *                 the number of milestones is NUM_OF_MILESTONES
   */
  async function createCampaign() {
      const {result: createCampaignCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CREATE_CAMPAIGN,
          [uintCV(TARGET_GOAL),
           uintCV(DEADLINE_DURATION),
           uintCV(NUM_OF_MILESTONES)
          ],
          OWNER
      );
      // The first time, we can call the function create-campaign
      expect(createCampaignCall).toHaveClarityType(ClarityType.ResponseOk);
  }

  /**
   * Helper function to donate to the existing campaign.
   * Pre-condition : The campaign is created before and its status is ACTIVE.
   *                 The user has sufficient funds to cover the donation amount.
   * Post-condition: The amount is subtracted from the user's wallet and is
   *                 added to the campaign's wallet. The campaign status remains
   *                 either ACTIVE or changes to FUNDED if the crowdfunding goal
   *                 is reached.
   * 
   * @param address The address of the user who makes the donation
   * @param amount The donation amount in  micro-STX
   */  
  async function donate(address: string, amount: number) {
      const {result: donateCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_DONATE,
          [uintCV(amount)],
          address
      );
      expect(donateCall).toHaveClarityType(ClarityType.ResponseOk);
      const responseValue = (donateCall as ResponseOkCV).value;
      expect(responseValue).toBeUint(amount);
  }

  /**
   * Helper function that posts a milestone.
   * Pre-condition : The campaign is in status STATUS_FUNDED.
   * Post-condition: The campaign status changed to STATUS_VOTE.
   * 
   * @param index The milestone index
   * 
   * @retrun the refunded amount in  micro-STX
   */
  async function postMilestone(index: number) {
      // Call post-milestone (details (string-ascii 100))
      //                     (index   uint)
      const {result: postMilestoneCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_POST_MILESTONE,
          [stringAsciiCV(MILESTONE_DETAILS),
           uintCV(index),
          ],
          OWNER
      );
      expect(postMilestoneCall).toHaveClarityType(ClarityType.ResponseOk);
  }

  /**
   * Helper function to vote for a given milestone.
   * Pre-condition : The campaign is created before and its status is VOTE.
   *                 The user has donated to the campaign.
   * Post-condition: The vote is casted and if the user's vote resulted in
   *                 either a confidence or no-confidce vote surpassing the
   *                 majority threshold, the status changes to FUNDED or
   *                 CANCELED respectively.
   * 
   * @param address The address of the user who makes the donation
   * @param amount The donation amount in  micro-STX
   */  
  async function vote(address: string, index: number, vote: boolean) {
      const {result: voteCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_VOTE,
          [uintCV(index),
            boolCV(vote)
          ],
          address
      );
      expect(voteCall).toHaveClarityType(ClarityType.ResponseOk);
  }

  /**
   * Helper function that claims a refund.
   * Pre-condition : The campaign is either in status STATUS_EXPIRED or
   *                 STATUS_CANCELED and the caller is eligible for a refund.
   * Post-condition: The caller received the refund and is not eligible for
   *                 another refund. The refund amounts is subtracted from the
   *                 campaign's wallet and is added to the user's wallet. The
   *                 campaign status remains the same.
   * 
   * @param address The address of the user who claims the refund
   * 
   * @retrun the refunded amount in  micro-STX
   */
  async function claimRefund(address: string): Promise<number> {
      // Call claim-refund()
      const {result: claimRefundCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CLAIM_REFUND,
          [],
          address
      );
      expect(claimRefundCall).toHaveClarityType(ClarityType.ResponseOk);
      const refundAmount = (claimRefundCall as ResponseOkCV).value;
      return Number(refundAmount);
  }

  /**
   * Helper function that claims a milestone.
   * Pre-condition : The campaign is in status STATUS_FUNDED and a vote of
   *                 confidence passed for the specified milestone which is not
   *                 claimed before.
   * Post-condition: The milestone is claimed. That amounts is subtracted from
   *                 the campaign's wallet and is added to the owner's wallet.
   *                 The campaign remains in status STATUS_FUNDED.
   * 
   * @param index The milestone index
   * 
   * @retrun the refunded amount in  micro-STX
   */
  async function claimMilestone(index: number): Promise<number> {
      const {result: claimMilestoneFundsCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CLAIM_MILESTONE_FUNDS,
          [uintCV(index)],
          OWNER
      );
      expect(claimMilestoneFundsCall).toHaveClarityType(ClarityType.ResponseOk);
      const claimedAmount = (claimMilestoneFundsCall as ResponseOkCV).value;
      return Number(claimedAmount);
  }  

  /**
   * Gets the campaign status
   * 
   * @return The new campaign status
   */  
  async function getStatus(): Promise<number>  {
      const {result: getStatusCall} = simnet.callReadOnlyFn(
          CONTRACT_NAME,
          FUNCTION_GET_STATUS,
          [],
          OWNER // Don't care - this function is just for testing purposes
      );
      expect(getStatusCall).toHaveClarityType(ClarityType.UInt);
      const status = (getStatusCall as UIntCV).value;
      return Number(status);
  }
  
  /**
   * Checks if the deadline passed and returns the campaign status.
   * If the campaign status is different from STATUS_ACTIVE, it does nothing and
   * simply returns the current campaign status.
   * If the campaign status is STATUS_ACTIVE, it checks if the deadline passed
   * and, if so, returns STATUS_EXPIRED. Othwerwise returns the current status
   * (i.e., STATUS_ACTIVE).
   * 
   * @return The campaign status after checking if the deadline passed for
   *         active campaigns
   */
  async function checkDeadline(): Promise<number>  {
      const {result: checkDeadlineCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CHECK_DEADLINE,
          [],
          OWNER // Don't care value; can be any user address
      );

      expect(checkDeadlineCall).toHaveClarityType(ClarityType.ResponseOk);
      const responseValue = (checkDeadlineCall as ResponseOkCV).value;
      const status = (responseValue as UIntCV).value;
      return Number(status);
  }

  /**
   * Checks if the deadline to vote passed and returns the campaign status.
   * If the campaign status is different from STATUS_VOTE, it does nothing and
   * simply returns the current campaign status.
   * If the campaign status is STATUS_VOTE, it checks if the deadline passed
   * and, if so, returns STATUS_FUNDED. Othwerwise returns the current status
   * (i.e., STATUS_VOTE).
   * 
   * @return The campaign status after checking if the deadline to vote passed
   *         for funded campaigns
   */
  async function checkVoteDeadline(): Promise<number>  {
      const {result: checkVoteDeadlineCall} = simnet.callPublicFn(
          CONTRACT_NAME,
          FUNCTION_CHECK_VOTE_DEADLINE,
          [],
          OWNER // Don't care value; can be any user address
      );

      expect(checkVoteDeadlineCall).toHaveClarityType(ClarityType.ResponseOk);
      const responseValue = (checkVoteDeadlineCall as ResponseOkCV).value;
      const status = (responseValue as UIntCV).value;
      return Number(status);
  } 

  /**
   * Gets the contract's funds
   * 
   * @return The campaign funds in micro-STX
   */
  async function getContractFunds(): Promise<number>  {
      const {result: getBalanceCall} = simnet.callReadOnlyFn(
          CONTRACT_NAME,
          FUNCTION_GET_BALANCE,
          [],
          OWNER // Don't care - this function is just for testing purposes
      );
      expect(getBalanceCall).toHaveClarityType(ClarityType.UInt);
      const status = (getBalanceCall as UIntCV).value;
      return Number(status);
  }

  /**
   * Sets the status of the campaign (even if a campaign has not been created).
   * This method is a 'hack' to facilitate testing.
   * 
   * @param status The new campaign status
   */
  async function setStatus(status: number) {
      const {result: setStatusCall} = simnet.callPrivateFn(
          CONTRACT_NAME,
          FUNCTION_SET_STATUS,
          [uintCV(status)],
          OWNER // Don't care - this function is just for testing purposes
      );
      expect(setStatusCall).toHaveClarityType(ClarityType.ResponseOk);
  }

  async function printDebugInfo() {
      const {result} = simnet.callReadOnlyFn(
          CONTRACT_NAME,
          "get-DEBUG-INFO",
          [],
          OWNER // Don't care - this function is just for testing purposes
      );
      expect(result).toHaveClarityType(ClarityType.UInt);
      const value = (result as UIntCV).value;
      console.log("------->" + value);
  }
});